const src = (path, line) => ({ path: `entry/src/main/ets/${path}`, line });
const units = '【新增跨平台适配】几何 1 vp = 1 iOS 逻辑 pt = 1 Android dp；系统字体角色 fp 经各端系统字体缩放API换算：iOS UIFontMetrics逐role，Android fp→sp并用平台非线性转换，禁止用单一倍率乘法或按截图倍率放大。';
const pageFrame = '【源码】使用实时窗口与安全边界；左右边界各取 max(视觉安全边距,19)，可用宽内将内容居中，宽上限 720；不以 390/760 样本宽代替运行时测量。';
const fontAssets = '【源码】ReaderInter → InterVariable.ttf；ReaderNotoSansSC → NotoSansSC-VF.otf；ReaderNotoSerifSCBold/Regular → NotoSerifSC-Bold/Regular.ttf。前者许可证为 rawfile/Inter-OFL.txt，后三个共享 rawfile/Noto-OFL.txt。';
const backBar = '【源码】PageBackBar 高 58，横向间隔 10；左右内距各 max(20,交互安全边距)，返回图标 24×24 在 44×44、半径 22 的目标内；标题单行省略。';
const pageTitle = '【源码】子页标题 ReaderNotoSerifSCBold，700，24 fp / 33 fp 行高，TOK_INK；不使用系统导航栏默认标题字体。';
const nativeLayout = '【源码】UIContext.showAlertDialog 由系统布局；调用方未指定卡宽、圆角、内距、字级、行高或触摸目标数值。浏览器的结构示意尺寸不是该系统控件的尺寸规范。';
const nativeType = '【源码】标题、正文和按钮文字交给当前系统 AlertDialog；除显式危险动作颜色外，没有调用方字体覆盖。长文本的系统折行不应伪称已由 HTML 像素验证。';
const nativeAdaptation = '【新增跨平台适配】用各端系统确认 / 结果适配器承接相同标题、正文、动作次序与 dismiss 语义；框架默认样式、屏幕阅读器和字号由目标端系统处理。若要求系统外壳逐像素一致，需另行取得原生测量证据，不能从此结构样本推导。';
const keyboardAdapter = '【新增跨平台适配】输入键盘出现时更新真实交互安全边界，并保持当前输入焦点、草稿和滚动位置；滚动使当前字段与对应动作可见。源未指定数字键盘或 URL 键盘时，不把平台默认输入类型改为新业务限制。';

export const specifications = {
  settings: {
    layout: [
      pageFrame,
      '【源码】全高 SettingsShell：底层纵向 Scroll、顶部浮动 AppTopBar、底部浮动 MainTabBar；滚动内容 top=58+8=66，区块间隔 12，滚动条隐藏。',
      '【源码】首页只含一个「设置」CategorySection，内为通用设置、书源管理、书架设置三行；卡片 Fill，高度随内容，1 vp TOK_BORDER，半径 8；内 top=9、bottom=1，标题后 gap=5。',
      '【源码】导航行最小高 58，左右内距 12，间隔 12；图标盒 28×28/r14，内图 15×15，尾部箭头 14×14，label 占剩余宽。整行承担点击。',
      '【源码】首页内容底留白=68+max(15,交互安全底距)+16；底栏仅「书架 / 设置」，当前设置项抑制重复选择。',
    ],
    typography: [
      fontAssets,
      '【源码】首页「设置」标题使用 TYPE_APP_HOME_TITLE：ReaderNotoSerifSCBold 700，29 fp / 38 fp。',
      '【源码】分节标题 ReaderInter 900，13 fp / 15.6 fp，标题容器高 16，左右 padding 12，单行省略；行 label ReaderInter 800，13 fp / 15.34 fp，TOK_INK，单行省略。',
      '【源码】底栏 label ReaderNotoSansSC 700，11 fp / 18 fp；图标从已实现 SVG day/night 资源读取。',
    ],
    behavior: [
      '【源码 · default】仅当前 L0 准入入口可见；同步、语言、启动页、权限、关于等受关闭的 product gate 限制，不补画不可达入口。',
      '【源码】通用设置只改变 activeSection；书源管理进入 source 路由；书架设置记录 settings 返回来源。点书架底栏返回书架；设置首页无返回按钮。',
      '【源码】CategoryRow 使用 ReaderPressFeedback；图标与标题装饰不形成第二套点击 / 状态；无文本输入与键盘。',
    ],
    adaptation: [
      units,
      '【新增跨平台适配】保留浮动导航、内部滚动留白及三行顺序；系统安全区只应用一次，不再叠加系统导航栏高度。窄窗 label 收缩并单行省略，尾部控件保留固有宽。',
      '【新增跨平台适配】在 iOS/Android 使用同一主题注册表及物理字体文件，不能把 ReaderInter 800/900 擅自降为默认系统 medium。',
    ],
    sources: [src('features/settings/SettingsPage.ets',134),src('features/shell/SettingsShell.ets',55),src('features/shell/SettingsShell.ets',157),src('features/settings/CategorySection.ets',23),src('features/settings/CategoryRow.ets',26),src('features/common/ReaderTypography.ets',56),src('features/common/ReaderFloatingBarMetrics.ts',6),src('features/common/ReaderFonts.ets',16),src('app/ReaderProductScope.ts',17),src('pages/Index.ets',1424)],
  },
  general: {
    layout: [
      pageFrame, backBar,
      '【源码】全高 Scroll，top=66、卡间距 12、底留白 max(12,交互安全底距)，无主底栏；「基础偏好」「行为与反馈」沿用首页 CategorySection。',
      '【源码】App主题行最小高 58、横内距 12、左右两列 gap=12；左列 icon28/内图15＋label Fill；右侧 ReaderSegmentedControl 固定 168×36/r8，1 vp 边框、四边 padding2。三个等分段各高30/r6，选中段独立1 vp描边。',
      '【源码】开关绘制 44×24/r999，旋钮 20×20/r10，位置 off=(2,2)、on=(22,2)；明确响应区 x0/y−10/w44/h44，整行也可切换。',
      '【源码】缓存行仍高至少58；尾部动作 minWidth66/maxWidth55%/minHeight34，padding左右10、上下8、r6，文案最多两行。整行点击调用清理，忙碌时由 handler 去重。',
      '【源码】独立恢复默认卡 minHeight58/r8、左右 padding13/12、gap10；图标盒28，内图15，箭头14。恢复结果 Text 位于此卡后，宽100%、padding12；不是结果路由。',
    ],
    typography: [
      fontAssets, pageTitle,
      '【源码】区块标题 Inter900 13/15.6；普通行 label Inter800 13/15.34、单行省略。App主题段 Inter Bold 12，单行，源未显式指定段字行高。',
      '【源码】缓存动作 Inter800 11/16，居中、最多2行；恢复默认 Inter400 16/19.2、TOK_DANGER、单行；恢复消息12 fp、TOK_MUTED，源未指定行高与字体族。',
      '【源码】分段颜色使用 ReaderSegmentedControl 的 SEG_BG/BORDER/SELECTED_BG/SELECTED_BORDER/TEXT_ACTIVE/TEXT_INACTIVE；不能把选中段改成页面主按钮填充色。',
    ],
    behavior: [
      '【源码 · default/theme-day/theme-night】选项「跟随 / 浅色 / 深色」映射 system/day/night；选中值来自 readerAppThemeMode。应用主题持久化失败恢复配置并系统 toast「主题保存失败，已恢复原配置」。',
      '【源码 · reduce-motion】autoCheckUpdate 默认true、reduceMotion默认false；行与开关都触发同一幂等目标值，先更新当前页，再经 Host 偏好队列保存；失败回读实际快照，当前入口没有新错误页或统一弹窗。',
      '【源码 · cache-busy/cache-success/cache-error】「清理文字缓存 → 清理中 → 已清理 / 清理失败」原行文字替换；在途请求重复点击直接返回；结束后允许再次点击。cache.clear scope=cache，无二次确认。',
      '【源码 · reset-busy/reset-success/reset-error】先系统确认；执行时整个 SettingsShell.enabled=false，清空旧 resetMessage；成功「已恢复界面与阅读设置」，false返回「恢复未完成，请重试」，异常「恢复未完成，已保留恢复记录；点击恢复默认重试」。保持原子页。',
      '【源码】恢复回调只允许当前 mounted/revision 写回；离开页面旧回调不能把新实例改成成功。通用设置返回改变 activeSection 为 home，无输入控件。',
    ],
    adaptation: [
      units,
      '【新增跨平台适配】保留固定168宽分段、行 label 的剩余宽 / 省略规则和缓存55%上限。较大用户字号不得缩小字级；允许 minHeight 行随内容增高，分段保持源码可见尺寸，触摸区可外扩且不可抢邻段事件。',
      '【新增跨平台适配】恢复 busy 应禁用同一页全部交互，包括返回与切换主题；缓存 busy 只去重缓存动作，不人为锁死全页。此差异必须由真实状态控制。',
    ],
    sources: [src('features/settings/SettingsPage.ets',152),src('features/settings/SettingsPage.ets',211),src('features/settings/SettingsPage.ets',309),src('features/settings/SettingsPage.ets',351),src('features/settings/SettingsPage.ets',504),src('features/settings/SettingsPage.ets',533),src('features/settings/SettingsOrchestrator.ets',68),src('features/common/ReaderSegmentedControl.ets',6),src('features/common/ReaderToggle.ets',19),src('features/shell/SettingsShell.ets',75),src('pages/Index.ets',1548)],
  },
  sources: {
    layout: [
      pageFrame, backBar,
      '【源码】全高 List 延伸到浮动栏后，contentStartOffset58，contentEndOffset=44+12+max(16,交互安全底距)；搜索、数量、状态、分组、类别属于首个 ListItem，会随列表滚动；导航与底动作栏浮动。',
      '【源码】搜索字段 h38/r8/1 vp边框、左右padding12、图标13、图文gap8；输入框h36，field顶部margin8。数量行 top margin8。',
      '【源码】手机状态与分组纵向 gap8；源码 isTablet 时横排 gap20，每组宽 max(0,(contentWidth−20)/2)，高36。状态五chip高32/r16，间隔8；设计宽58/58/58/72/72，各乘 min(1,max(0,controlWidth−32)/318)。',
      '【源码】分组 folder15、文字左margin12、select左margin22；select宽=max(0,controlWidth−74)，高36/r8。文字位于(14,10)，可用宽w−42；chevron12×12位于(w−21,12)，开时转180°。',
      '【源码】类别横向Scroll高40、top margin8、chip高32/r16、左右padding12、gap8；「全部类型 / 小说 / 漫画 / 音乐/有声 / 下载/文件 / 视频/外部媒体 / 其他/混合」。',
      '【源码】源行高70、左padding12、列间gap8、顶部1 vp分隔；信息列Fill可收缩，源名与类别gap6，信息纵gap8。可选登录44×28/r7；检测44×28/r7；状态徽标24×18/r999、圆点7；toggle44×24、触摸44×44。',
      '【源码】底栏两等分动作高44/r8、gap10，上margin12、下margin max(16,交互安全底距)；新增图标source_add18×18、图文gap8。空列表卡paddingTop64、内容gap8；筛选0条无额外空匹配文案。',
      '【源码】状态banner padding8/top margin8/r7，信息Fill、最多2行；只有 statusKind=error 才显示重试。分组面板在全高根Stack：x/y为实测global坐标减宿主origin，宽同select、每行36/r8、选中行置顶，余项单行省略；透明背景点按关闭。',
    ],
    typography: [
      fontAssets, pageTitle,
      '【源码】搜索 ReaderInter400 12 fp（未显式行高）；数量 ReaderInter400 10/12.5，单行；状态banner NotoSansSC11/16，错误动作11 Bold。',
      '【源码】状态chip NotoSansSC Bold11；分组标题Bold13；分组值 / 面板值 ReaderInter400 12/14.52；类别NotoSansSC11。',
      '【源码】源名 NotoSansSC Bold13/15.34、单行省略；类别Regular10/12.5、不可压缩；域名Regular10/12.5、单行省略；检测说明10/12.5、单行省略。登录 / 检测Bold11；底动作Bold13，均单行。',
      '【源码】空态标题 ReaderNotoSerifSCBold700 15/22；说明 ReaderInter400 12/18。状态色只按passed/failed/其他三类使用页面STATUS_GOOD/ERROR/MUTED_BG与DOT角色。',
    ],
    behavior: [
      '【源码 · default/loading/load-error/empty】读取先清列表并显示「正在读取 Core 书源数据…」；失败显示「书源列表读取失败：{error}」和重试，也满足空卡条件；重试只重新 source.list。无源时数量为0个源 /0启用，loading不画空卡。',
      '【源码 · filter-empty/group-open】关键词trim后忽略大小写，匹配name或baseUrl，与group/category/status条件求交；数量显示 filtered/total，启用数量统计完整sources而非已筛选行。分组取实际非空group去重，仅有全部分组时点select不展开；自定义可见但禁用且opacity.45。',
      '【源码 · checking/check-passed/check-failed】单源检测在途去重并进入串行chain，默认search L1+L2；检测按钮opacity.62且回调拒绝重入，badge checking仍采用muted色。通过行消息「搜索检测通过 · {duration}ms」，失败保留实际reason。只更新行，不新设页顶banner。',
      '【源码】登录仅loginUrl非空显示。onClick仍可到orchestrator；当checkingSourceIds含该源时逻辑拒绝重复登录。取消将该源标unchecked、保存「登录 / 验证已取消」，但unchecked行不绘制checkMessage；完成后继续默认检测，不能宣告已经登录成功。',
      '【源码】启停不是乐观开关：source.update确认后才显示新值；提交失败保留原值并banner「书源启停失败：…」。停用后尝试清cookie；清cookie或后续list读回失败仅记录，不撤销已确认启停值。离开页不取消已排队写操作，旧session不能回写新页。',
      '【源码 · importing/import-success/import-warning/import-error】JSON弹窗先关闭；原页「正在导入本地书源… / 正在导入在线书源…」。成功/部分成功显示确切计数并刷新sources；已提交但list失败显示warning「Core已导入N但列表刷新失败」，不改称导入失败；错误banner重试仍是读取列表。系统picker取消不制造导入成功或新取消页面。',
      '【源码】上方更多与底部批量管理同进sourceTools，新增打开JsonImportDialog；返回来源可为设置或搜索，搜索普通返回恢复原查询而不自动重新检索。',
    ],
    adaptation: [
      units, keyboardAdapter,
      '【源码】isTablet由Index的deviceInfo.deviceType===tablet传入，不是窗口达到760即横排；来源列表宽仍按720上限和当前安全区解析。',
      '【新增跨平台适配】将各端设备类别适配成明确的tablet flag并保持其原分支；折叠屏 / 窄窗重新量测各组宽，不写死分组面板位置。下拉overlay与列表共用坐标系，滚动或安全区变化须重取锚点。',
      '【新增跨平台适配】检测/登录可见28高、筛选32高、分组36高与源一致；需增加可触摸面积时仅扩命中目标，不扩大绘制尺寸或让相邻行接收同一点击。源toggle已明确44×44区域，直接保留。',
    ],
    sources: [src('features/source/SourceManagementPage.ets',126),src('features/source/SourceManagementPage.ets',197),src('features/source/SourceManagementPage.ets',232),src('features/source/SourceManagementPage.ets',280),src('features/source/SourceManagementPage.ets',308),src('features/source/SourceManagementPage.ets',346),src('features/source/SourceManagementPage.ets',382),src('features/source/SourceManagementPage.ets',425),src('features/source/SourceManagementPage.ets',540),src('features/source/SourceManagementPage.ets',619),src('features/source/SourceManagementPage.ets',677),src('features/common/ReaderSearchField.ets',255),src('features/common/ReaderSelect.ets',165),src('features/common/ReaderSelectPanel.ets',152),src('features/common/ReaderToggle.ets',19),src('features/source/SourceOrchestrator.ets',84),src('features/source/SourceOrchestrator.ets',129),src('features/source/SourceOrchestrator.ets',214),src('features/source/SourceOrchestrator.ets',351),src('features/source/SourceGateway.ts',470),src('pages/Index.ets',1630)],
  },
  'source-tools': {
    layout: [
      backBar,
      '【源码】工具页全高Scroll，top66、bottom=max(16,交互安全底距)、左右至少19；此页宽上限是实时window.width，宽屏不使用720 cap。卡间距16，顺序状态 / 导出 / 批量 / 非idle检测进度 / 源列表 / 非空editorSourceId编辑卡 / 调试卡。',
      '【源码】status卡padding12/r8/1 vp边框、panel-soft；其他卡padding12/r10/1 vp边框。导出、批量、编辑器使用TOK_SURFACE_SOLID；进度、源列表、调试使用TOK_CARD_BG。批量、导出、编辑、调试内容纵gap12；源列表内容gap8。',
      '【源码】批量上排3等分按钮、下排4等分按钮，横gap8；action高42/r8/1 vp边框、Fill，disabled opacity.62。每行源高58、左右padding8、内部gap8；选择 / 编辑 / 调试小按钮高30/r7、左右padding10。',
      '【源码】源编辑List高度=min(420,max(58,sourceCount×58))；进度结果List高=min(320,max(58,resultCount×58))，两个内部列表均独立滚动且不显示滚动条。空源List仍58高，不补虚构空结果文案。',
      '【源码】进度标题 / phase同一Row、gap8；progress轨道与填充高8/r4；当前项最多2行省略；四个counter等分/gap8，各高32/r7。结果最新在前，每行58、左右padding8、下边1 vp。',
      '【源码】JSON TextArea宽100%、高320、padding8/r8/1 vp边框；下方取消 / 校验并保存两个等分42高按钮；confirmedRefreshFailed才追加解释文字及重新读取按钮。',
      '【源码】调试卡模式与深度是系统Select，同一Row间距12，无显式Select字号或高度；关键词TextInput高40/r8/1 vp边框、左右padding12。调试日志List高=min(360,max(32,logCount×32))，日志自身按内容折行，不硬裁为单行。',
    ],
    typography: [
      fontAssets, pageTitle,
      '【源码】卡标题 NotoSansSC Bold14，源没有指定行高；状态 NotoSansSC12/18（busy用TOK_PRIMARY_TEXT，否则TOK_MUTED）；说明11/17；技术说明10/16。',
      '【源码】源名 / 结果源名NotoSansSC Bold12、单行省略；源URL ReaderInter10、单行省略；可选lastCheckSummary10、单行省略；结果message NotoSansSC10、单行省略；结果状态Bold11，不改成全局成功文案。',
      '【源码】批量/action NotoSansSC Bold12；小按钮Bold11；counter / phase Bold11；当前源 NotoSansSC11/17、TOK_INK。进度percent为 round(completed×100/total) 后限制0..100。',
      '【源码】JSON monospace11、未指定行高；debugKey NotoSansSC12；检测对象 ReaderInter11、单行省略；日志monospace10/16，state−1用页面错误色，其他TOK_INK。',
    ],
    behavior: [
      '【源码 · default/loading/load-error/selected】进入时以原源管理的已确认sources作seed并busy重新读取；成功「已读取 Core 数据」，失败状态卡保持原页。全选 / 清空 / 行选择只接受非busy且无pendingOperation；selectedIds按真实存在源归一化。',
      '【源码】busy时所有冲突批量动作、导出全部、行选择 / 编辑 / 调试被guard且opacity.62；未选任何源时清空、导出所选、检测、启停、删除也不可用。返回栏未被此页代码禁用，不新增退出确认。',
      '【源码 · check-running/check-stopping/check-complete/check-stopped/check-error】仅running时「停止检测」可点；stopping为「停止中…」且不可点。逐源检测使用immutable selection，实时发布结果；停止保留已完成结果 / 计数，未完成源不伪装失败。完成/已停止/已中断均为原卡phase，结束busy恢复其他操作。',
      '【源码】checkMode=search/explore；checkDepth2..5：列表L1+L2、详情追加L3、目录追加L4、正文追加L5。默认搜索/列表，keyword.trim空值交Core默认「我的」；分项能力不支持时报真实错误，不降级为搜索。',
      '【源码】批量启停逐源source.update，可形成已提交prefix；失败读回并显示已完成N/total，不能把整批视为原子失败。删除先系统确认，回读后显示删除数与独立cookie清理失败数。',
      '【源码 · editor/editor-busy/editor-error/editor-readback-error】本页载入原始BookSource JSON；draft上限16 MiB，busy或pending时更新草稿被逻辑拒绝（TextArea本身未显式disabled）。取消同样被guard。save失败保留草稿；已确认但readback失败保留编辑卡与「重新读取已保存书源」，该动作只source.list，不重复source.import。',
      '【源码】sourceId=bookSourceUrl主键必须保持，不能隐式迁移URL。编辑保存且list成功才清editorText并关闭卡；读取已保存数据后若未找到源仍保留草稿供核对。',
      '【源码 · export-cancelled/export-error】每次导出先凭据系统确认；Core生成JSON，再系统保存，取消仅状态「已取消导出」；成功含导出数和文件名，错误在原状态卡。',
      '【源码 · debug-error】点任一行调试，用当前模式/深度/key执行该源检测；原调试卡显示对象sourceId与逐条日志，失败日志不是另一个错误页。key上限4096，busy/pending时草稿及选择变更被拒绝；系统Select显式disabled，TextInput未显式disabled。',
    ],
    adaptation: [
      units, keyboardAdapter,
      '【新增跨平台适配】保持工具页全宽安全边距分支和三个独立滚动列表的高度上限；不要套用源管理720 cap，也不要把源列表、编辑、调试拆为新增路由。JSON编辑使用保留换行的等宽字体输入。',
      '【新增跨平台适配】42/30高是源绘制尺寸；触摸扩展可在相邻目标不重叠的范围增至44逻辑单位，不能改变3/4等分布局。高字号下按钮文案允许在独立目标内可读，不以缩小字级挤进固定宽。',
      '【新增跨平台适配】平台Select外壳与键盘不是源逐像素指定部分；映射同样选项顺序及2..5深度。编辑忙状态须保持已提交草稿快照，不能接收新文字并误用于在途save；也不能用取消编辑代替停止检测。',
    ],
    sources: [src('features/source/SourceToolsPage.ets',200),src('features/source/SourceToolsPage.ets',253),src('features/source/SourceToolsPage.ets',302),src('features/source/SourceToolsPage.ets',397),src('features/source/SourceToolsPage.ets',432),src('features/source/SourceToolsPage.ets',466),src('features/source/SourceToolsPage.ets',529),src('features/source/SourceToolsPage.ets',574),src('features/source/SourceToolsPage.ets',631),src('features/source/SourceToolsPage.ets',651),src('features/source/SourceToolsPage.ets',736),src('features/source/SourceToolsOrchestrator.ets',141),src('features/source/SourceToolsOrchestrator.ets',188),src('features/source/SourceToolsOrchestrator.ets',211),src('features/source/SourceToolsOrchestrator.ets',266),src('features/source/SourceToolsOrchestrator.ets',381),src('features/source/SourceToolsOrchestrator.ets',451),src('features/source/SourceToolsOrchestrator.ets',466),src('features/source/SourceToolsOrchestrator.ets',523),src('features/source/SourceToolsOrchestrator.ets',564),src('features/source/SourceGateway.ts',346)],
  },
  'source-login': {
    layout: [
      '【源码】ArkWebExecutionHost的interactive全宽全高，zIndex10000；Web占100%×100%，顶栏绘制在其上方，源不是系统外部浏览器。没有应用底栏。',
      '【源码】顶栏Row h56、左右padding18、gap12；左取消、中央Fill Column gap2、右完成。标题和可选currentUrl各单行省略，容器背景及shadow radius8/offsetY2来自ArkWeb页面角色。',
      '【源码】Web interactive可聚焦 / touch聚焦 / hit-test，在线图片开启；非interactive背景执行仅1×1、opacity.001、不可聚焦且hit-test None，不能作为第二个可见登录页。',
    ],
    typography: [
      '【源码】顶栏取消与完成14 fp Bold；title15 fp Bold；currentUrl11 fp，未显式字体族 / 行高。此处采用平台文本默认族，不能臆断为Inter或Noto标题。',
      '【源码】标题由ReaderRuntimeOwner生成「{sourceName} · 登录 / 验证」；URL使用redactedHttpUrl，非空才显示。四类文本颜色使用ArkWebExecutionHost自己的主题角色。',
      '【源码】站点HTML/CSS字体、验证码、表单与加载内容来自真实URL；空白区域是设计稿不制造网站截图的示意，不是应用已实现的空态文案。',
    ],
    behavior: [
      '【源码 · default】取消调用cancelInteractive请求取消当前交互任务；完成调用finishInteractive设置当前job.userFinished，执行器再结束并resolve交互Promise；两个动作只作用于当前interactive surface，没有即时登录成功承诺。',
      '【源码】SourceOrchestrator进入时行置checking / 等待登录验证，任务进入相同operationChain；完成才执行默认search L1+L2，取消 / 异常标unchecked并记录已取消（unchecked行隐藏该说明）。',
      '【源码】Host使用来源profileId及已有会话语义，pagebegin只在当前surface更新已脱敏URL；网络策略可拦截真实request；没有额外登录成功页或第一张图片验证关卡。',
    ],
    adaptation: [
      units,
      '【新增跨平台适配】用当前端嵌入Web宿主适配器保持同样的source会话隔离、cookie拥有者、完成 / 取消回调和网络策略；不得通过新外部浏览器丢失会话。键盘、站点滚动与网页焦点交给真实Web实例。',
      '【新增跨平台适配】56高顶栏之外补安全区只一次；标题/URL保持Fill省略。取消 / 完成源未指定扩展响应区，移植时可只扩触摸区域至44逻辑单位并保持14字号及可见外观。',
    ],
    sources: [src('app/ArkWebExecutionHost.ets',46),src('app/ArkWebExecutionHost.ets',60),src('app/ArkWebExecutionHost.ets',118),src('app/ArkWebExecutor.ts',515),src('app/ReaderRuntimeOwner.ts',354),src('features/source/SourceOrchestrator.ets',170),src('features/source/SourceManagementPage.ets',455)],
  },
  'json-import': {
    layout: [
      '【源码】全高居中overlay，背景角色66000000、zIndex200；ReaderDialogSurface json-import宽=min(520,两侧交互安全边界与20边距内可用宽)，四边padding16/r14/1 vp边框，无阴影。',
      '【源码】标题Fill、关闭文字52×36；headerGap16，form各组gap16，在线链接Column gap8，bodyActionsGap16，底部action stacked布局、高44/r8/宽100%。',
      '【源码】body順序：描述 → 本地JSON按钮h44/r8 → 在线链接label → URL TextInput h44/r8/1 vp边框、左右padding12 → Raw提示 → 条件验证说明；本地按钮是body动作，不是第二个底部按钮。',
      '【源码】URL不提供source submitButton以外独立新确认步骤；标题单行省略，说明 / 验证文字按内容折行，源没有截断这些正文的maxLines。关闭按钮为文字「关闭」，不是X图标。',
    ],
    typography: [
      fontAssets,
      '【源码】标题 ReaderNotoSerifSCBold700 22/28、TOK_INK；关闭NotoSansSC Regular12、TOK_MUTED；描述NotoSansSC12/19、TOK_MUTED。',
      '【源码】本地JSON按钮NotoSansSC Bold13；在线label Bold12；URL输入ReaderInter12；Raw提示/空URL错误NotoSansSC10/16，后者TOK_DANGER。底部在线按钮NotoSansSC Bold13/16。',
    ],
    behavior: [
      '【源码 · default】从源管理新增打开；关闭调用onDismiss。选本地文件先关闭此框后进入真实系统picker；非空在线提交也先关闭再Host下载 / Core导入。业务提交不能仍停在此框并声称已完成。',
      '【源码 · empty-url】trim后空URL不dismiss，原字段下提示「请输入在线 JSON 的 HTTP/HTTPS 地址」；一旦onChange即清旧验证消息。此组件只检查为空，HTTP(S)与JSON准入由后续真实Host/Core负责。',
      '【源码】键盘onSubmit和底部从在线链接导入共用submitOnlineImport；源未设特定URL键盘类型、自动聚焦或硬URL正则。overlay背景没有注册mask点击dismiss；只有明确关闭入口。',
    ],
    adaptation: [
      units, keyboardAdapter,
      '【源码】json-import usesKeyboardSafeArea=true用于交互左右边界解析；源码表面不是一个已定义纵向键盘推移 / 自动滚动算法。',
      '【新增跨平台适配】纵向可用高度减去实际键盘遮挡和安全区；空间不够时表单区域可滚动，标题 / 显式关闭和提交目标可达，保留草稿与条件错误。此是移植补充约束，不能说成ArkUI已实测行为。',
      '【新增跨平台适配】保持520 cap、20侧边距及44高提交；关闭的可见52×36不改为X，可仅扩其触摸高度至44。本地选择取消返回原源页，不添加弹窗中取消导入成果。',
    ],
    sources: [src('features/common/JsonImportDialog.ets',46),src('features/common/JsonImportDialog.ets',73),src('features/common/JsonImportDialog.ets',138),src('features/common/JsonImportDialog.ets',152),src('features/common/ReaderSurfaceSpecs.ets',133),src('features/common/ReaderDialogSurface.ets',106),src('features/common/ReaderDialogSurface.ets',155),src('features/common/ReaderDialogSurface.ets',226),src('pages/Index.ets',1812)],
  },
  'restore-defaults': {
    layout: [nativeLayout,'【源码】一个确认框：「恢复界面与阅读设置」＋完整保留项说明，primary「取消」，secondary「恢复默认」；危险按钮显式TOK_DANGER。'],
    typography: [nativeType,'【源码】正文逐字来自SettingsPage；「界面与阅读设置」不是移除书库、源或凭据的确认。'],
    behavior: [
      '【源码 · default】重复请求在resetInFlight时忽略。取消回调不执行恢复；确认只在mounted且发起时revision仍有效时进入performRestoreDefaults。源未显式设置autoCancel，不能宣称有源码指定的mask dismiss政策。',
      '【源码】确认后回原general页执行恢复，整个设置壳禁用、消息清空；有 durable pending intent，按Host偏好 / 阅读 / 朗读 / 书架封面 / 外观协调恢复，持久化完成后才成功。',
      '【源码】保留书籍、书源、阅读进度、书签、导入字体文件及同步 / 朗读服务凭据；异常保留恢复记录并允许原恢复入口重试。没有提交已确认 / 恢复完成独立路由。',
    ],
    adaptation: [units,nativeAdaptation,'【新增跨平台适配】结果回调和离开页面的generation守卫与原逻辑一致；不借用确认框遮挡全页来替代执行期间的显式禁用状态。'],
    sources: [src('features/settings/SettingsPage.ets',504),src('features/settings/SettingsPage.ets',516),src('features/settings/SettingsPage.ets',108),src('features/settings/LocalConfigurationReset.ts',66),src('features/settings/SettingsOrchestrator.ets',103)],
  },
  'source-result': {
    layout: [nativeLayout,'【源码】结果在source路由上用系统对话框autoCancel=true；普通情况一个「知道了」，从搜索且关键词非空为「继续管理 / 用新书源搜索「{keyword}」」。'],
    typography: [nativeType,'【源码】标题为「书源导入完成 / 书源导入失败」；message来自importedCount、failureSummary、refreshWarning或真实Error.message，不以设计fixture数量作产品固定值。'],
    behavior: [
      '【源码 · default/partial】成功无warning文案「Core 已导入 N 个书源。」；部分成功追加「失败 M 个书源」；列表readback失败使用「Core 已导入N个书源，但列表刷新失败：…」且保留已确认事实。标题仍是书源导入完成。',
      '【源码 · error】真实import异常才走书源导入失败；没有在本系统结果弹窗里新增重试导入按钮；源页banner的重试重新读源列表。',
      '【源码 · from-search】仅成功 / 部分成功经搜索来源专用函数且旧keyword非空时提供再次搜索按钮；keyword空退化为普通知道了。继续管理不切路由；用新书源搜索调用returnFromSourceManagement(true)，普通返回false不自动重新检索。',
      '【源码】系统结果展示前核对route===source；页面已离开不弹旧结果。picker取消没有completion，不产生该结果框。',
    ],
    adaptation: [units,nativeAdaptation,'【新增跨平台适配】保留源页作为背景并复用真实查询keyword；按钮全文必须可读，不能截去「用新书源搜索」动作的目标关键词或把普通返回绑定为自动搜索。'],
    sources: [src('pages/Index.ets',1824),src('pages/Index.ets',1871),src('pages/Index.ets',1891),src('pages/Index.ets',1756),src('features/source/SourceOrchestrator.ets',264),src('features/source/SourceOrchestrator.ets',300)],
  },
  'source-export': {
    layout: [nativeLayout,'【源码】title「导出文件含登录凭据」、完整Cookie / Authorization提示；primary「继续导出」，secondary「取消」，autoCancel=true。不是新的导出配置页。'],
    typography: [nativeType,'【源码】导出警告的技术字段名按SourceToolsPage原文保留，不把凭据提示移到仅设计备注。'],
    behavior: [
      '【源码 · default】全量或所选导出每次先调用confirmExportThen；取消 / dismiss不导出，继续才进入实际action。调用方忙碌或所选为0时不能触发对应入口。',
      '【源码】确认后工具页busy「正在由 Core 导出书源…」；Core生成JSON后再调用系统保存，拿到filename才显示已导出N及文件名；filename undefined仅显示已取消导出，错误仅原status卡。',
      '【源码】Core输出保留原静态Cookie/Authorization，不在Host构造第二份假JSON；无额外提交确认、独立正在取消导出或取消完成页。',
    ],
    adaptation: [units,nativeAdaptation,'【新增跨平台适配】文档保存适配器必须区分用户取消、成功文件名、异常三种结果，并在异步owner/session失效时抑制旧UI回写；保留系统保存动作的真实文件归属。'],
    sources: [src('features/source/SourceToolsPage.ets',253),src('features/source/SourceToolsPage.ets',693),src('features/source/SourceToolsPage.ets',719),src('features/source/SourceToolsOrchestrator.ets',188)],
  },
  'source-delete': {
    layout: [nativeLayout,'【源码】title「删除书源」、正文「确定删除所选 N 个书源吗？相关 Host 登录会话也会清除，删除后无法恢复。」；primary取消，secondary删除、页面危险颜色，autoCancel=true。'],
    typography: [nativeType,'【源码】N是consumeSourceToolsSelection后的有效选择数，非画布样本常量；危险色由Index.requestSourceDelete角色提供。'],
    behavior: [
      '【源码 · default】仅route===sourceTools且传入非空有效选择才弹；选择在弹框前已consume并清空，取消不会自动重新选回。确认仍需route===sourceTools才deleteSelected。',
      '【源码】确认后状态「正在删除 N 个书源…」，Core删除确认后逐源清Host会话，随后source.list；结果原页「已删除N个书源」及独立会话清理失败数。',
      '【源码】Core删除count合法性和Hostcookie清理分别记账；后续list异常仍在原状态「书源删除失败：…」，不能擅自添加自动撤销已提交删除或恢复登录会话流程。',
    ],
    adaptation: [units,nativeAdaptation,'【新增跨平台适配】确认选择保存为不可变作用范围，在系统框显示期间不从当前勾选状态重算N；取消与route失效都不执行删除，清理失败不把已删除事实恢复为未删除。'],
    sources: [src('pages/Index.ets',1919),src('features/source/SourceToolsOrchestrator.ets',404),src('features/source/SourceGateway.ts',442)],
  },
};
