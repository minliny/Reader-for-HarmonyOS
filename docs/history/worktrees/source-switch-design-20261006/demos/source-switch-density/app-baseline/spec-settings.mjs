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
      '【源码】首页内容底留白=68+max(15,交互安全底距)+16；底栏仅「书架 / 设置」，当前设置项不重复导航，tapBottomScrollTop开启时重复点当前项将首页Scroll滚到顶部。',
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
      '【源码】CategoryRow 使用 ReaderPressFeedback；图标与标题装饰不形成第二套点击 / 状态；无文本输入与键盘。operationFeedback位于首页区块前，按当前receipt/readFacts显示消息及恢复动作。',
      '【源码】general与home共用同一SettingsPage实例；恢复尚在途时系统返回home，SettingsShell仍禁用首页三行与底栏触摸控件，直到原实例接收恢复结果。',
    ],
    adaptation: [
      units,
      '【新增跨平台适配】保留浮动导航、内部滚动留白及三行顺序；系统安全区只应用一次，不再叠加系统导航栏高度。窄窗 label 收缩并单行省略，尾部控件保留固有宽。',
      '【新增跨平台适配】在 iOS/Android 使用同一主题注册表及物理字体文件，不能把 ReaderInter 800/900 擅自降为默认系统 medium。',
    ],
    sources: [src('features/settings/SettingsPage.ets',247),src('pages/Index.ets',1883),src('features/settings/SettingsPage.ets',177),src('features/shell/SettingsShell.ets',57),src('features/shell/SettingsShell.ets',168),src('features/settings/CategorySection.ets',15),src('features/settings/CategoryRow.ets',27),src('features/common/ReaderTypography.ets',90),src('features/common/ReaderFloatingBarMetrics.ts',6),src('features/common/ReaderFonts.ets',21),src('app/ReaderProductScope.ts',17),src('pages/Index.ets',1712)],
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
      '【源码 · default/theme-day/theme-night】选项「跟随 / 浅色 / 深色」映射 system/day/night；选中值来自 readerAppThemeMode。当前主题保存失败保留已接受选择，并由仍有效的页面显示系统toast「主题保存尚未确认，当前选择已保留，请稍后重试」。',
      '【源码 · auto-check-off/reduce-motion】autoCheckUpdate默认true、reduceMotion默认false；行与开关走同一目标值，页面展示Settings owner已接受快照，不自行绘制尚未接受的乐观镜像。refreshing或confirmation=unknown时开关拒绝新输入；核对与重试保存当前设置保留已接受偏好。',
      '【源码 · cache-busy/cache-success/cache-error/cache-unknown/cache-continuable/cache-reconcile-busy】原行按busy / confirmed / unknown / undispatched显示「清理中 / 已清理 / 结果未确认 / 清理失败」。在途去重，unknown再点原清理只提示，不重新派发；原操作消息和「核对清理结果 / 继续原操作」按canRetry及canContinueOriginal显示。核对为读取原回执，只有显式继续才能继续原清理。',
      '【源码 · reset-busy/reset-success/reset-error/reset-incomplete】先系统确认；执行时整个 SettingsShell.enabled=false，清空旧 resetMessage，壳内返回 / 主题 / 行动作等 UI 触摸控件均不可用；成功「已恢复界面与阅读设置」，false返回「恢复未完成，请重试」，异常「恢复未完成，已保留恢复记录；点击恢复默认重试」。',
      '【源码】恢复回调只允许当前 mounted/revision 写回；新页面实例不接收旧回调。Index 系统 Back 在 general 分支仍将 activeSection 改为 home，没有 resetInFlight guard；同一个 SettingsPage 仍 mounted 时，恢复继续并由该实例接收结果。通用设置无输入控件。',
      '【演示】App主题、自动检查更新、减少动态效果分别保存，缓存结果和恢复任务另存；点击一项保留其他值。App主题选择同步画布配色，跟随采用当前系统配色；恢复成功样本才恢复偏好默认值。画布外任务样本不执行实际偏好写入或缓存清理。',
      '【源码】operationFeedback在通用设置恢复卡之后。receipt/readFacts决定原消息及「刷新设置」，canRetryAccepted显示「重试保存当前设置」；缓存恢复独立追加消息及动作。动作捕获当前Runtime、页面临时身份与generation，退役回调不操作新实例；同一反馈亦出现在设置首页。',
    ],
    adaptation: [
      units,
      '【新增跨平台适配】保留固定168宽分段、行 label 的剩余宽 / 省略规则和缓存55%上限。较大用户字号不得缩小字级；允许 minHeight 行随内容增高，分段保持源码可见尺寸，触摸区可外扩且不可抢邻段事件。',
      '【新增跨平台适配】恢复 busy 只复现设置壳的触摸控件禁用；系统 Back / 系统返回手势保留 Index 原路由分支，不把 UI 按钮禁用扩展成导航拦截。缓存 busy 只去重缓存动作。',
    ],
    sources: [src('features/settings/SettingsPage.ets',247),src('features/settings/SettingsPage.ets',438),src('features/settings/SettingsCacheCleanupOwner.ts',45),src('features/common/ReaderRecoveryAction.ets',15),src('features/settings/SettingsPage.ets',174),src('features/settings/SettingsPage.ets',196),src('features/settings/SettingsPage.ets',304),src('features/settings/SettingsPage.ets',402),src('features/settings/SettingsPage.ets',463),src('features/settings/SettingsPage.ets',652),src('features/settings/SettingsPage.ets',681),src('features/settings/SettingsOrchestrator.ets',136),src('features/common/ReaderSegmentedControl.ets',3),src('features/common/ReaderToggle.ets',20),src('features/shell/SettingsShell.ets',77),src('pages/Index.ets',808),src('pages/Index.ets',2226)],
  },
  sources: {
    layout: [
      pageFrame, backBar,
      '【源码】全高 List 延伸到浮动栏后，contentStartOffset58，contentEndOffset=44+12+max(16,交互安全底距)；搜索、数量、状态、分组、类别属于首个 ListItem，会随列表滚动；导航与底动作栏浮动。',
      '【源码】搜索Row h44、top margin8，左搜索字段Fill（绘制h38/r8/1 vp边框、左右padding12、图标13、图文gap8，输入h36），右导入入口40×40/r12、source_add18、主色背景，Row gap8。两处新增入口都打开同一JsonImportDialog。数量行top margin8。',
      '【源码】手机状态与分组纵向 gap8；源码 isTablet 时横排 gap20，每组宽 max(0,(contentWidth−20)/2)，高36。状态五chip高32/r16，间隔8；设计宽58/58/58/72/72，各乘 min(1,max(0,controlWidth−32)/318)。',
      '【源码】分组 folder15、文字左margin12、select左margin22；select宽=max(0,controlWidth−74)，高36/r8。文字位于(14,10)，可用宽w−42；chevron12×12位于(w−21,12)，开时转180°。',
      '【源码】类别横向Scroll高40、top margin8、chip高32/r16、左右padding12、gap8；「全部类型 / 小说 / 漫画 / 音乐/有声 / 下载/文件 / 视频/外部媒体 / 其他/混合」。',
      '【源码】源行高76、左padding0/右8、列间gap8、顶部1 vp分隔；左36×40/r10/panel-soft图标盒内folder20×20。信息列Fill可收缩，源名与类别gap6，信息纵gap8。可选登录44×28/r7；检测44×28/r7；状态徽标24×18/r999、圆点7；toggle44×24、触摸44×44。',
      '【源码】底部宿主Row高48，两个等分动作实际绘制高44/r8、gap10、垂直居中；上margin12、下margin max(16,交互安全底距)。新增图标source_add18×18、图文gap8。空列表卡paddingTop64、内容gap8；筛选0条无额外空匹配文案。',
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
      '【源码 · login-waiting】登录仅loginUrl非空显示。请求进入串行 chain 后原行 checking、说明「等待登录 / 验证」；onClick仍可到orchestrator，当checkingSourceIds含该源时拒绝重复登录。取消将该源标unchecked、保存「登录 / 验证已取消」，但unchecked行不绘制checkMessage；完成后继续默认检测。',
      '【源码】启停不是乐观开关：source.update确认后才显示新值；提交失败保留原值并banner「书源启停失败：…」。停用后尝试清cookie；清cookie或后续list读回失败仅记录，不撤销已确认启停值。离开页不取消已排队写操作，旧session不能回写新页。',
      '【源码 · importing/import-online/import-success/import-warning/import-error/import-refresh-warning/import-refresh-warning-partial】JSON弹窗先关闭；原页「正在导入本地书源… / 正在导入在线书源…」。成功 / 部分成功显示确切计数并刷新sources；Core 已提交但 list 失败显示 warning「Core 已导入 N 个书源，但列表刷新失败：{error}」，保留此前可见列表和已确认导入事实，系统结果标题仍「书源导入完成」。只有 error banner 的重试重新读取列表；系统picker取消不制造完成或新取消页面。',
      '【源码】上方更多与底部批量管理同进sourceTools，新增打开JsonImportDialog；返回来源可为设置或搜索，搜索普通返回恢复原查询而不自动重新检索。',
      '【演示】每行绑定具体sourceId；关键词、状态、类型与分组即时求交，计数按当前投影更新。检测样本及确认后的启停值作用于所选源，保留其他源状态；分组面板使用实测trigger左上坐标和同宽，点透明背景或提交选择后收起。',
      '【源码 · receipt-refreshing/receipt-refresh-failed/receipt-unknown/original-unknown/original-cleanup/original-busy】statusBanner优先显示当前receipt/readFacts，允许核对时重试调用onReconcile而非新写入；original.blocked时替换为ReaderRecoveryNotice及「核对原操作回执」，canRetryOriginal才有「继续原操作 / 继续原清理」。该源管理owner存在unknown或blocked时启停控件禁用；在途刷新和原操作busy也拒绝新启停。列表读取不能把unknown变成confirmed。',
    ],
    adaptation: [
      units, keyboardAdapter,
      '【源码】isTablet由Index的deviceInfo.deviceType===tablet传入，不是窗口达到760即横排；来源列表宽仍按720上限和当前安全区解析。',
      '【新增跨平台适配】将各端设备类别适配成明确的tablet flag并保持其原分支；折叠屏 / 窄窗重新量测各组宽，不写死分组面板位置。下拉overlay与列表共用坐标系，滚动或安全区变化须重取锚点。',
      '【新增跨平台适配】检测/登录可见28高、筛选32高、分组36高与源一致；需增加可触摸面积时仅扩命中目标，不扩大绘制尺寸或让相邻行接收同一点击。源toggle已明确44×44区域，直接保留。',
    ],
    sources: [src('pages/Index.ets',1968),src('features/source/SourceManagementPage.ets',323),src('features/source/SourceManagementPage.ets',610),src('features/common/ReaderRecoveryNotice.ets',16),src('features/common/ReaderRecoveryAction.ets',15),src('features/source/SourceManagementPage.ets',195),src('features/source/SourceManagementPage.ets',255),src('features/source/SourceManagementPage.ets',338),src('features/source/SourceManagementPage.ets',385),src('features/source/SourceManagementPage.ets',405),src('features/source/SourceManagementPage.ets',427),src('features/source/SourceManagementPage.ets',458),src('features/source/SourceManagementPage.ets',502),src('features/source/SourceManagementPage.ets',618),src('features/source/SourceManagementPage.ets',667),src('features/source/SourceManagementPage.ets',725),src('features/common/ReaderSearchField.ets',255),src('features/common/ReaderSelect.ets',166),src('features/common/ReaderSelectPanel.ets',155),src('features/common/ReaderToggle.ets',20),src('features/source/SourceOrchestrator.ets',139),src('features/source/SourceOrchestrator.ets',238),src('features/source/SourceOrchestrator.ets',321),src('features/source/SourceOrchestrator.ets',411),src('features/source/SourceOrchestrator.ets',425),src('features/source/SourceOrchestrator.ets',466),src('features/source/SourceGateway.ts',601),src('pages/Index.ets',2378),src('pages/Index.ets',2609)],
  },
  'source-tools': {
    layout: [
      backBar,
      '【源码】工具页全高Scroll，top66、bottom=max(16,交互安全底距)、左右至少19；此页宽上限是实时window.width，宽屏不使用720 cap。卡间距16，顺序状态 / 条件恢复动作 / 导出 / 批量 / 非idle检测进度 / 源列表 / 非空editorSourceId编辑卡 / 调试卡。',
      '【源码】status卡padding12/r8/1 vp边框、panel-soft；其他卡padding12/r10/1 vp边框。导出、批量、编辑器使用TOK_SURFACE_SOLID；进度、源列表、调试使用TOK_CARD_BG。批量、导出、编辑、调试内容纵gap12；源列表内容gap8。',
      '【源码】批量上排3等分按钮、下排4等分按钮，横gap8；action高42/r8/1 vp边框、Fill，disabled opacity.62。每行源高58、左右padding8、内部gap8；选择 / 编辑 / 调试小按钮高30/r7、左右padding10。',
      '【源码】源编辑List高度=min(420,max(58,sourceCount×58))；进度结果List高=min(320,max(58,resultCount×58))，两个内部列表均独立滚动且不显示滚动条。空源List仍58高，不补虚构空结果文案。',
      '【源码】进度标题 / phase同一Row、gap8，标题Fill；卡内纵gap12，progress轨道与填充高8/r4；当前项仅 currentSourceName 非空显示、最多2行省略；四个counter等分/gap8，各高32/r7。没有结果时显示「每个书源完成后，结果会立即出现在这里。」；有结果才显示实时结果标题和独立List，最新在前，每行58、左右padding8、下边1 vp。',
      '【源码】JSON TextArea宽100%、高320、padding8/r8/1 vp边框；下方取消 / 校验并保存两个等分42高按钮；confirmedRefreshFailed才追加解释文字及重新读取按钮。',
      '【源码】调试卡模式与深度是系统Select，同一Row间距12，无显式Select字号或高度；关键词TextInput高40/r8/1 vp边框、左右padding12。debugSourceId非空才显示「最近一次检测详情」及对象，否则「书源调试」。日志List始终存在，高=min(360,max(32,logCount×32))，空日志仍留32高；日志自身按内容折行，不硬裁为单行。',
    ],
    typography: [
      fontAssets, pageTitle,
      '【源码】卡标题 NotoSansSC Bold14，源没有指定行高；状态 NotoSansSC12/18（busy用TOK_PRIMARY_TEXT，否则TOK_MUTED）；说明11/17；技术说明10/16。',
      '【源码】源名 / 结果源名NotoSansSC Bold12、单行省略；源URL ReaderInter10、单行省略；可选lastCheckSummary10、单行省略；结果message NotoSansSC10、单行省略；结果状态Bold11，不改成全局成功文案。',
      '【源码】批量/action NotoSansSC Bold12；小按钮Bold11；counter / phase Bold11；当前源 NotoSansSC11/17、TOK_INK。进度percent为 round(completed×100/total) 后限制0..100。',
      '【源码】通过counter用TOK_PRIMARY_DARK，未通过counter用app.SourceToolsPage.batchCheckCard.batchCounter.FFA8584D，错误counter用其FF9A6A1F角色，剩余用TOK_MUTED；phase仅failed用app.SourceToolsPage.batchCheckCard.fontColor.FFA8584D，其他TOK_PRIMARY_TEXT。结果通过用TOK_PRIMARY_TEXT，未通过 / 错误分别用batchResultRow的FFA8584D / FF9A6A1F角色；不得统一为同一种成功或错误色。',
      '【源码】JSON monospace11、未指定行高；debugKey NotoSansSC12；检测对象 ReaderInter11、单行省略；日志monospace10/16，state−1用页面错误色，其他TOK_INK。',
      '【源码】每条日志逐字格式「{index+1}. [{state}] {message}」，state−1用app.SourceToolsPage.debugLogRow.fontColor.FFA8584D，其他TOK_INK；JSON已确认读回失败解释NotoSansSC10/16、TOK_MUTED。日志内容、URL、计数、trace、时间在预览中均为外部标注的示例数据，排版及状态条件来自源码。',
    ],
    behavior: [
      '【源码 · default/loading/load-error/selected】每次真实进入 tools 均重置 EMPTY 快照：选择为0、无编辑卡 / 草稿 / 调试对象 / 日志，默认 search / depth2 / keyword「我的」；以原源管理的已确认sources作seed并busy重新读取，成功「已读取 Core 数据」，失败状态卡保持原页。全选 / 清空 / 行选择只接受非busy且无pendingOperation；selectedIds按真实存在源归一化。画布外 selected 样本用两源范围，不改变真实入口为空的事实。',
      '【源码】busy时所有冲突批量动作、导出全部、行选择 / 编辑 / 调试被guard且opacity.62；未选任何源时清空、导出所选、检测、启停、删除也不可用。返回栏未被此页代码禁用，不新增退出确认。',
      '【源码 · check-initial/check-first/check-running/check-stopping/check-complete/check-mixed/check-stopped/check-stopped-empty/check-error】初始running、currentIndex=0、结果空；首源开始后当前项出现，首结果未返回前仍为空。仅running时「停止检测」可点；stopping为「停止中…」且不可点。检测保留选择范围并逐源发布passed / failed / error；单源异常记检测错误并继续，外层异常才phase=failed。停止保留已完成前缀 / 计数，无结果停止不伪造完成项。所有phase均原卡状态，结束busy恢复其他操作。',
      '【源码】checkMode=search/explore；checkDepth2..5：列表L1+L2、详情追加L3、目录追加L4、正文追加L5。默认搜索/列表，keyword.trim空值交Core默认「我的」；分项能力不支持时报真实错误，不降级为搜索。',
      '【源码】执行时使用该次 mode / depth / key，busy拒绝配置更改；结束后 Select 可以配置下一次检测，但只更新 checkMode / checkDepth，不改旧 statusMessage、debugLogs 或 batch结果。历史summary / 结果文案来自 outcome.mode / levelsPassed，不能随当前Select重算成新的通过事实。预览分别冻结批检和单源调试的范围、模式与深度，保留两类结果各自的配置快照。',
      '【源码 · enable-busy/enable-success/disable-busy/disable-success/update-partial/update-error】启停在执行前consume并清空选择；状态「正在启用 / 停用 N 个书源…」，逐源source.update形成已提交prefix，全部读回成功「已启用 / 停用 N 个书源」。更新异常但回读成功为「批量更新中断：已完成 N/total；{error}」；回读也失败为「批量更新书源失败（已完成 N/total）：{error}」。停用后cookie清理失败只日志，不撤销已确认启停事实。',
      '【源码 · delete-busy/delete-success/delete-cleanup-warning/delete-error】删除弹框前consume并清空选择，取消仍保持清空；确认后原状态「正在删除 N 个书源…」，回读成功「已删除 N 个书源」，Host清会话失败追加「；M 个 Host 登录会话清理失败」。Core删除 / 回读异常仅原状态「书源删除失败：{error}」，不自动撤销已确认删除。',
      '【源码 · editor-loading/editor-load-error/editor/editor-busy/editor-error/editor-readback-error】先原状态「正在读取原始 BookSource…」，读取成功才显示本页原始JSON卡；读取失败只原状态「书源读取失败：{error}」。draft上限16 MiB，busy或pending时更新草稿被逻辑拒绝（TextArea本身未显式disabled）；取消 / 保存按钮busy禁用。保存失败保留草稿；已确认但readback失败保留编辑卡与重读解释 / 按钮，只source.list不重复source.import。',
      '【源码 · editor-switch-loading/editor-switch-error/editor-switch-success】已有编辑卡时点击同源或另一源的「编辑」，openEditor起始只更新 busy / status，不先清 editorSourceId / editorText / editorReadback；原卡、草稿和已确认重读说明保持，动作busy禁用。读取异常保留原卡及用户草稿，仅显示原状态读取失败；读取成功才将 editorSourceId / editorText 替换为目标源原始JSON，并清 editorReadback。不存在换源前丢弃草稿确认框。',
      '【源码】sourceId=bookSourceUrl主键必须保持，不能隐式迁移URL。编辑保存且list成功才清editorText并关闭卡；读取已保存数据后若未找到源仍保留草稿供核对。',
      '【源码 · editor-reread-busy/editor-reread-not-found/editor-reread-success/editor-saved/editor-cancelled】重读时原状态「正在读取已保存书源…」，原草稿 / 解释 / 按钮保持，三个编辑动作busy禁用。list返回但没有该sourceId为「已确认，但当前列表未找到该书源；草稿保留供核对」，仍留卡；重读异常继续已确认刷新失败状态。找到该源才清草稿 / 关卡并「已确认，当前读取结果可用」；首次保存读回成功「书源已由 Core 校验并保存」；非busy取消清草稿 / 关卡并「已取消编辑」。',
      '【源码 · export-busy/export-success/export-cancelled/export-error】每次先凭据系统确认；全量导出不清选择，所选导出确认继续后才consume选择，确认取消保留选择。原状态「正在由 Core 导出书源…」，Core生成JSON后系统保存；成功「已导出 N 个书源：{filename}」，filename undefined为「已取消导出」，异常「书源导出失败：{error}」。busy禁用冲突操作，结果不独立成页。',
      '【源码 · debug-busy/debug-passed/debug-failed/debug-error】点任一行调试，用当前模式 / 深度 / key执行该源检测；开始即设置对象并清日志，原状态「正在检测所选能力…」。通过 / 未通过summary含所选模式、实际通过级别、耗时 / trace或failureReason及同次Host证据数；异常只原状态。批检开始清对象 / 日志，每完成一源才换成该源的最新对象 / 日志，当前正在检测源不替换上一已完成源日志。key上限4096，busy/pending时草稿及选择变更被拒绝；系统Select显式disabled，TextInput未显式disabled。',
      '【源码 / 演示】source列表值、编辑卡及草稿、批检进度、调试对象及日志各自保留；导出、启停、删除、编辑与调试结果仅更新该操作实际发布的字段。删除和已确认启停保留到后续操作及返回源管理；新进入工具会话才按EMPTY快照重置工具临时状态，源记录仍来自已确认列表。',
      '【源码 · receipt-unknown/editor-save-unknown/editor-reread-unknown/original-unknown/original-cleanup/original-busy】状态卡依次优先original.blocked.message、recovery.message、statusMessage，卡后显示ReaderRecoveryAction。unknown或original保护禁用写入、行编辑和校验保存；原编辑保存unknown或original保护时取消也禁用，original保护时JSON输入readonly。普通读取不能确认先前保存，保留草稿；核对原操作回执与显式继续原操作/原清理均绑定当前generation，未确认状态不能擅自恢复为成功。',
      '【源码】导出系统框通过ReaderNativeAlertOwner捕获当前mount、exportRevision、sourceListRevision及selectionRevision；删除框同样捕获当前路由宿主和列表/选择revision。显示期间作用范围变化或旧页面退役后不执行已过期动作。',
    ],
    adaptation: [
      units, keyboardAdapter,
      '【新增跨平台适配】保持工具页全宽安全边距分支和三个独立滚动列表的高度上限；不要套用源管理720 cap，也不要把源列表、编辑、调试拆为新增路由。JSON编辑使用保留换行的等宽字体输入。',
      '【新增跨平台适配】42/30高是源绘制尺寸；触摸扩展可在相邻目标不重叠的范围增至44逻辑单位，不能改变3/4等分布局。高字号下按钮文案允许在独立目标内可读，不以缩小字级挤进固定宽。',
      '【新增跨平台适配】平台Select外壳与键盘不是源逐像素指定部分；映射同样选项顺序及2..5深度。保留每次检测的结果配置快照，不因下一次Select选择改写历史结果。编辑忙状态须保持既有草稿，读取另一源成功后才替换当前source/draft，失败不提前清草稿；不能接收新文字并误用于在途save，也不能用取消编辑代替停止检测。',
    ],
    sources: [src('pages/Index.ets',1929),src('features/source/SourceToolsPage.ets',485),src('features/source/SourceToolsPage.ets',614),src('features/source/SourceToolsPage.ets',716),src('features/source/SourceToolsOrchestrator.ets',764),src('features/settings/RulesMutationOwner.ts',315),src('features/source/SourceToolsPage.ets',231),src('features/source/SourceToolsPage.ets',285),src('features/source/SourceToolsPage.ets',334),src('features/source/SourceToolsPage.ets',374),src('features/source/SourceToolsPage.ets',381),src('features/source/SourceToolsPage.ets',429),src('features/source/SourceToolsPage.ets',507),src('features/source/SourceToolsPage.ets',541),src('features/source/SourceToolsPage.ets',604),src('features/source/SourceToolsPage.ets',620),src('features/source/SourceToolsPage.ets',639),src('features/source/SourceToolsPage.ets',666),src('features/source/SourceToolsPage.ets',687),src('features/source/SourceToolsPage.ets',707),src('features/source/SourceToolsPage.ets',753),src('features/source/SourceToolsOrchestrator.ets',183),src('features/source/SourceToolsOrchestrator.ets',259),src('features/source/SourceToolsOrchestrator.ets',282),src('features/source/SourceToolsOrchestrator.ets',303),src('features/source/SourceToolsOrchestrator.ets',425),src('features/source/SourceToolsOrchestrator.ets',448),src('features/source/SourceToolsOrchestrator.ets',462),src('features/source/SourceToolsOrchestrator.ets',484),src('features/source/SourceToolsOrchestrator.ets',501),src('features/source/SourceToolsOrchestrator.ets',580),src('features/source/SourceToolsOrchestrator.ets',632),src('features/source/SourceToolsOrchestrator.ets',644),src('features/source/SourceGateway.ts',443),src('pages/Index.ets',2430),src('pages/Index.ets',2737)],
  },
  'source-login': {
    layout: [
      '【源码】ArkWebExecutionHost的interactive全宽全高，zIndex10000；Web占100%×100%，顶栏绘制在其上方，源不是系统外部浏览器。没有应用底栏。',
      '【源码】顶栏Row h56、左右padding18、gap12；左取消、中央Fill Column gap2、右完成。标题和可选currentUrl各单行省略，容器背景及shadow radius8/offsetY2来自ArkWeb页面角色。',
      '【源码 · default/starting/long-url】currentUrl 初始为空时只显示标题；pagebegin更新非空脱敏URL后在标题下显示第二行，gap2；长URL仅本行末尾省略，不换行或另占网站内容区域。',
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
      '【新增跨平台适配】常规字级沿用56高顶栏，顶部安全区只应用一次；左右内距各取max(18,对应安全边界)。标题/URL保持Fill单行省略，取消 / 完成保留固有宽、单行且不参与压缩。取消 / 完成源未指定扩展响应区，移植时可仅扩触摸区域至44逻辑单位。',
      '【新增跨平台适配 / 压力预览】130%与200%时顶栏按标题、可选URL及动作的真实行高增长，最小56；Web区域从顶栏下缘开始占剩余高度，避免增高文字覆盖网页。该补充不是ArkWeb当前固定56覆层已经实现的行为，各端按其字体缩放曲线测量，不能照搬浏览器文字倍率。',
    ],
    sources: [src('app/ArkWebExecutionHost.ets',46),src('app/ArkWebExecutionHost.ets',60),src('app/ArkWebExecutionHost.ets',95),src('app/ArkWebExecutionHost.ets',118),src('app/ArkWebExecutionHost.ets',125),src('app/ArkWebExecutor.ts',515),src('app/ReaderRuntimeOwner.ts',613),src('features/source/SourceOrchestrator.ets',278),src('features/source/SourceManagementPage.ets',543)],
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
      '【源码】ReaderFormField form-url的onSubmit和底部在线按钮共用submitOnlineImport；源未设特定URL键盘类型、自动聚焦或硬URL正则。overlay背景没有注册mask点击dismiss；「关闭」按钮调用onDismiss，Index.onBackPress发现jsonImportVisible时dismissJsonImport并消费系统 Back。Index按jsonImportGeneration挂载并检查当前Runtime、导航generation和源宿主身份，旧弹层动作不能提交到新来源。',
      '【源码 / 演示】关闭即卸载此弹层；再次打开初始化空URL及空验证消息。输入变化清验证，Enter与底部按钮复用同一trim空值门禁，非空先关闭并交Host/Core；预览仅在画布外说明后续真实操作，不制造已导入结果。',
    ],
    adaptation: [
      units, keyboardAdapter,
      '【源码】json-import usesKeyboardSafeArea=true用于交互左右边界解析；源码表面不是一个已定义纵向键盘推移 / 自动滚动算法。',
      '【新增跨平台适配】纵向可用高度减去实际键盘遮挡和安全区；空间不够时表单区域可滚动，标题 / 显式关闭和提交目标可达，保留草稿与条件错误。此是移植补充约束，不能说成ArkUI已实测行为。',
      '【新增跨平台适配】保持520 cap、20侧边距及44高提交；常规字级关闭文字目标52×36，文字保留单行且不改为X。高字号时目标高度容纳实际行高，200%压力预览取44高；其余平台按字体缩放曲线测量。本地选择取消返回原源页，不添加弹窗中取消导入成果。',
      '【新增跨平台适配】分别保留遮罩不关闭、显式关闭与系统 Back 关闭语义；IME先消费返回还是将事件传至Index属于原生验证边界，未取得证据前不得宣称第一次系统返回必定只收起键盘或必定关闭弹层。',
    ],
    sources: [src('pages/Index.ets',2527),src('features/common/ReaderControlSpecs.ets',334),src('features/common/JsonImportDialog.ets',49),src('features/common/JsonImportDialog.ets',76),src('features/common/JsonImportDialog.ets',125),src('features/common/JsonImportDialog.ets',130),src('features/common/ReaderSurfaceSpecs.ets',139),src('features/common/ReaderDialogSurface.ets',107),src('features/common/ReaderDialogSurface.ets',156),src('features/common/ReaderDialogSurface.ets',227),src('pages/Index.ets',734),src('pages/Index.ets',2597)],
  },
  'restore-defaults': {
    layout: [nativeLayout,'【源码】一个确认框：「恢复界面与阅读设置」＋完整保留项说明，primary「取消」，secondary「恢复默认」；危险按钮显式TOK_DANGER。'],
    typography: [nativeType,'【源码】正文逐字来自SettingsPage；「界面与阅读设置」不是移除书库、源或凭据的确认。'],
    behavior: [
      '【源码 · default】重复请求在resetInFlight时忽略。取消回调不执行恢复；确认只在mounted且发起时revision仍有效时进入performRestoreDefaults。源未显式设置autoCancel，不能宣称有源码指定的mask dismiss政策。',
      '【源码】确认后在general执行恢复，整个设置壳触摸控件禁用、消息清空；Index系统Back仍可从general切设置首页，没有resetInFlight拦截。该实例仍mounted时恢复继续；真正离开组件后的旧回调受mounted/revision守卫。durable pending intent按Host偏好 / 阅读 / 朗读 / 书架封面 / 外观协调恢复，持久化完成后才成功。',
      '【源码】保留书籍、书源、阅读进度、书签、导入字体文件及同步 / 朗读服务凭据；异常保留恢复记录并允许原恢复入口重试。没有提交已确认 / 恢复完成独立路由。',
    ],
    adaptation: [units,nativeAdaptation,'【新增跨平台适配】结果回调和离开页面的generation守卫与原逻辑一致；不借用确认框遮挡全页来替代执行期间的显式禁用状态。'],
    sources: [src('features/settings/SettingsPage.ets',652),src('features/settings/SettingsPage.ets',664),src('features/settings/SettingsPage.ets',150),src('features/settings/SettingsPage.ets',174),src('features/settings/LocalConfigurationReset.ts',73),src('features/settings/SettingsOrchestrator.ets',175),src('pages/Index.ets',808)],
  },
  'source-result': {
    layout: [nativeLayout,'【源码】结果在source路由上用系统对话框autoCancel=true；普通情况一个「知道了」，从搜索且关键词非空为「继续管理 / 用新书源搜索「{keyword}」」。'],
    typography: [nativeType,'【源码】标题为「书源导入完成 / 书源导入失败」；message来自importedCount、failureSummary、refreshWarning或真实Error.message，不以设计fixture数量作产品固定值。'],
    behavior: [
      '【源码 · default/partial/committed-refresh-failure/committed-refresh-failure-partial】成功无warning文案「Core 已导入 N 个书源。」；部分成功追加「，失败 M 个书源」。已确认但列表readback失败使用「Core 已导入 N 个书源，但列表刷新失败：{error}」；无部分失败时句末「。」，有部分失败时追加同样failureSummary，标题仍「书源导入完成」，源页同步保留warning而非error。',
      '【源码 · error】真实import异常才走书源导入失败；没有在本系统结果弹窗里新增重试导入按钮；源页banner的重试重新读源列表。',
      '【源码 · from-search/from-search-refresh-failure】仅成功 / 部分成功（含已确认刷新失败）经搜索来源专用函数且旧keyword非空时提供再次搜索按钮；keyword空退化为普通知道了。继续管理不切路由；用新书源搜索调用returnFromSourceManagement(true)，普通返回false不自动重新检索。',
      '【源码】系统结果展示前核对route===source；页面已离开不弹旧结果。picker取消没有completion，不产生该结果框。',
    ],
    adaptation: [units,nativeAdaptation,'【新增跨平台适配】保留源页作为背景并复用真实查询keyword；按钮全文必须可读，不能截去「用新书源搜索」动作的目标关键词或把普通返回绑定为自动搜索。'],
    sources: [src('pages/Index.ets',2609),src('pages/Index.ets',2665),src('pages/Index.ets',2708),src('pages/Index.ets',2462),src('features/source/SourceOrchestrator.ets',372),src('features/source/SourceOrchestrator.ets',411),src('features/source/SourceOrchestrator.ets',425)],
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
    sources: [src('features/source/SourceToolsPage.ets',285),src('features/source/SourceToolsPage.ets',722),src('features/source/SourceToolsPage.ets',732),src('features/source/SourceToolsOrchestrator.ets',259)],
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
    sources: [src('pages/Index.ets',2737),src('features/source/SourceToolsOrchestrator.ets',448),src('features/source/SourceGateway.ts',555)],
  },
};
