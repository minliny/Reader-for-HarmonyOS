// Current Host implementation facts. Platform-port requirements are marked “移植适配”.
const r = (file,line) => ({path:`entry/src/main/ets/features/reading/${file}`,line});
const c = (file,line) => ({path:`entry/src/main/ets/features/common/${file}`,line});
const s = (file,line) => ({path:`entry/src/main/ets/features/source/${file}`,line});
const b = (file,line) => ({path:`entry/src/main/ets/features/bookshelf/${file}`,line});
const i = line => ({path:'entry/src/main/ets/pages/Index.ets',line});
const n = (file,line) => ({path:`entry/src/main/cpp/bookturn/${file}`,line});
const adaptation = [
  '移植适配：1vp 对应 1 个 iOS 逻辑 pt / Android 逻辑 dp；fp 是支持系统字体缩放的字体单位，不能按屏幕物理像素整体缩放组件。',
  '移植适配：保留同一书籍/章节/章内 Unicode scalar 锚点与异步操作身份；原生测量、图片解码、语音、文件选择和系统窗口 API 需平台适配，网页稿不构成平台验收。',
];
const controlLayout = [
  '小说使用同一透明控制层包含 topbar 与 dock，无全屏灰色遮罩；正文保留在下层。Compact 宽度分界 W<600；expanded W>=600。参考窗口 phone390×844/tablet760×960。',
  'Phone topbar 最大360×54，左右至少15，设计 top19；Tablet 最大702×54，左右至少29。实 top=max(19,safeTop+10)。Back44×42/24 icon，书名与章·源 gap5，换源62×42/20 icon，更多34×42/20 icon；Row gap8。',
  '实际 ReaderControlPanel Stage 的 Quick/Full 共用 fullPanelWidth：phone=min(364,W-2×max(13,safeHorizontal))，居中；tablet=min(720,W-max(26,safeHorizontal)-max(14,safeHorizontal))，right=max(14,safeHorizontal)。layout 中另算的 tablet dockWidth340/right25 未被这个 Stage 消费，不能当 live Quick 尺寸。',
  'Full 高度预算先算 budgetTop=max(88,topbarTop+54+8)，bottomBudget=max(20,safeBottom)，FullH=min(phone736/tablet852,max(0,H-budgetTop-bottomBudget))。实际 Stage 底锚 gap=max(phone19/tablet33,safeBottom)，其 top=H-gap-FullH；QuickH=min(phone330/tablet252,FullH)，Quick top=H-gap-QuickH。无safe时390×844的Full top89，760×960的Full top75。这是当前预算/呈现锚点差异，移植前不得改成88而称原样。',
  '同一 p∈[0,1]：shellHeight=QuickH+(FullH-QuickH)×p，shellY=FullH-shellHeight；grabber42×4，x=(W-42)/2，y=shellY+9。',
  'Content inset=min(13,W/4)；FullContentW=max(0,W-2×inset)，QuickContentW=max(0,FullContentW-52)；ContentY=shellY+29+28p，ContentH=QuickContentH+(max(0,FullH-70)-QuickContentH)p，QuickContentH=min(190,max(0,QuickH-140))。',
  'Full header 30高，x=inset,y=shellY+19,opacity=p；普通title x24/y5、UIBold14/20，收起40×26/right0/y2、UIBold10/14/primary色。search/autoPage按HeaderGeometry补(1,1)、宽减2，Inter title14/16.8/y6.5、收起10/12；replace完成另走独立HeaderGeometry。导航80高，x12,y=shellY+shellHeight-93+20p,opacity=1-p；Full 不保留可点击导航。亮度38×190，沿右侧移出并 opacity=1-p。',
];
const controlType = [
  'Topbar 书名 NotoSerifSC Bold700/16fp/19.2，章节·书源 NotoSerifSC Regular400/12fp/14.4，换源 NotoSansSC700/12fp/14.4；三项字距0，按各自角色显式行高，标题列高45/gap5、换源gap3.75/icon顶margin1.25。',
  '正文之外阅读控制使用 TOK_READ_INK/MUTED/PRIMARY、TOK_READ_SURFACE、TOK_SURFACE_PANEL/PANEL_SOFT、TOK_LINE/LINE_STRONG；TOK_BORDER_W=1。日夜资源选择实际 SVG 的 theme_night 版本。',
];
const controlBehavior = [
  'Quick/Full 是同一个模块的连续布局；小说Full“收起”（替换为“完成”）回到该模块 Quick。重复点已激活目录/朗读/界面/设置导航回 home；其余点切对应模块。',
  '控制层抓手 raw touch 由单个 pointer/epoch 控制；临时层、业务遮挡或 input disabled 时不接管。中途重按暂停现有 clock，新目标从当前已发布位置接续。',
  'IME先消费系统Back的真实顺序各端待核验；应用收到Back后临时层→Full收同模块Quick→Quick模块回home→home关闭→退出处理。若正在forward过渡，Back先回该过渡fromLocation；退出须先停止朗读并持久化当前进度。操作内加载与失败留在现有组件。',
];
function control(extra) {
  return {layout:[...controlLayout,...extra.layout],typography:[...controlType,...extra.typography],
    behavior:[...controlBehavior,...extra.behavior],adaptation:[...adaptation,...(extra.adaptation||[])],
    sources:[r('ReaderLayoutGeometry.ts',309),r('ReaderControlMotionGeometry.ts',103),r('ReaderControlPanel.ets',675),r('ReaderControlPanel.ets',840),r('ReaderControlPanel.ets',1462),r('LocalReadingExperience.ets',6136),r('ReaderControlSessionState.ts',223),...extra.sources]};
}

export const specifications = {
  reader: {
    layout:[
      'normal/continuous：同一 ReadingSurface 文字/正文图像 fragment；分页使用已测量物理页，continuous 使用连续 Scroll，控制层覆盖时正文不换成另一页面。',
      '实时正文水平边距：未提供 insetProfile 时 compact=max(16,min(28,24×W/390))，expanded=44.44；有配置取 compact/expanded 配置。最终两侧同为 max(配置,safeHorizontal,expanded且无配置时(W-720)/2)。设计 profile32 是 fallback 描述，不能当成实时固定边距。',
      '正文 top：metrics ready且statusBarHeight>0时使用实际 informationBottom+8、cutout/system safe top 的最大值；未知 metrics 使用至少 phone72/tablet92.44。bottom=max(phone47.99/tablet56.44,实际 system/cutout/gesture/navigation bottom)。',
      '章标题只在当前物理页要求 showChapterTitle 时出现；title track=实测标题高+18。bodyWidth=max(1,W-left-right)，bodyHeight=max(1,H-top-bottom-titleTrack)。',
      'failed/source-failed：原正文轨道内 Scroll，Column gap20、padding24；标题/动态错误码/重试/阅读设置，远程才有切换书源；source-failed 多“继续当前书源”。没有新路由。',
      '当前ReaderShell按contentKind区分文本与漫画：文本ReadingSurface的image fragment成功时Image、缺像素时Blank保留imageHeight；漫画使用已接通的MangaReadingSurface。稿件正向图像为原创样例，不作为真实加载取证。漫画primary error row显示本次加载错误/重试，相邻错误只保留测量槽；不新增独立失败页。',
      'text-selection：原生手柄/默认编辑菜单由系统生成，源未固定宽高/r/完整组成；UI只示范选区与COPY项目，平台外观为评审近似，不能声明为iOS/Android已验收几何。',
      '页角书签 topAccessory24×24；clock/title同一实测安全区slot，clock侧够宽放其左方gap5，否则进title lane。Y=rowTop+max(0,(rowHeight−24)/2)，取消预览opacity.35；该槽不接收点击。',
      '书签下拉实时位移 bookmarkOffsetY=min(viewportHeight/2,max(0,currentOffsetY)/2)。ReaderPageTurnStage整体translateY，只有top-info以−translateY反向补偿；正文和bottom-info随之下移，页角Accessory在Host独立固定。稿件preview静态样本downward96vp→48vp；cancel样本先peak96vp后回拉downward24vp→12vp，24<96/2所以预览取消/opacity.35；filled静止样本offset0。样本距离只是评审取值，公式与48vp门槛来自源码。',
      '会话胶囊 minW TTS94/auto96，高24/r12/border1、paddingX6；leading16×16、gap4、pause16×16位于W−20/y4、icon8、TTS耳机11；hit rect y−10/h44、shadow8/y3/#12463423。X=max(visualLeft,footerRight−sessionW)，Y=footerTop+max(0,(24−sessionH)/2)，页码给它预留W+5。',
    ],
    typography:[
      '默认正文 serif，18fp、lineHeightMultiplier1.96、paragraphSpacing16vp、letterSpacing0fp、indent none、alignment justify；字号12–40，行距倍率1.2–2.8，段距0–32，字距-2–4。',
      '章标题 TYPE_READER_CHAPTER_TITLE：NotoSerifSC Bold700/23fp，layout.titleLineHeightFp28.75；字号支持系统 scale，标题必须按实际换行高度先测量后分页。',
      '沉浸 time/progress/pageOrdinal：NotoSansSC400/12fp、14.4行高。top实际bookTitle/clock，bottom progress/pageOrdinal。胶囊label NotoSansSC700/10fp/12.5，countdown900/8fp/8、baselineOffset−0.65fp。错误标题20fp/Medium、正文16fp；原Button样式由平台控件决定。',
    ],
    behavior:[
      '分页：点击横向前三分之一上一页，后三分之一下一页，中间三分之一控制栏；手势横移8vp最先抢占，向上24vp为上一页，向下48vp为书签预览；长按500ms且移动<8vp可选择文本（设置启用）。continuous另用12vp二维移动slop，tap需<500ms；native List滚动，边界up只在|deltaY|>12且|deltaY|>|deltaX|时选相邻章，Cancel不选章。',
      '目录/书签/搜索/refresh/换源业务目标保留原页到目标位置提交；coldFirstPaint与合格ordinary先publish可见正文，随后异步persist，不把所有翻页写成等待durable。初始失败重试原加载，换源失败重试原候选。',
      'ordinary资格：sourceSwitchTransactionId/pendingControlSelection为空，gateway.canPersistPresentedProgress=true，positionMigration为空或unchanged。Gateway还要求pendingSourceSwitchResolver为空、无pending switch、Core支持reading.progress.compareAndSet.v1；不是只判断同章。普通测量另核对paged/selection/lifecycle/chapter/layout signature。',
      'coldFirstPaint要求旧visiblePage/fragments尚未发布，无pendingControlSelection/sourceSwitchTransactionId/gateway pending switch；Local:5874先publish，:5886才persist。prepared ordinary:12684先完成普通呈现交接并异步persistPresentedPageTurn，late receipt只更新仍有效confirmed progress，不回退/重放另一页。',
      '原生选区门控：configured&&mounted&&!exitRequested&&pageReady，且controlVisible/controlObscured/interactionBlocked/pageTurnActive/autoPageActive/ttsActive全false。owner变化关闭旧选区，返回不恢复旧range。onCreateMenu保留系统items，只接管COPY；UTF-16 range扣syntheticPrefixLength并裁到可见原文，不复制首行显示缩进。禁用后消费过期COPY，失败原Toast“复制失败，请重试”；没有自造批注/书签/朗读菜单。',
      '页角书签只在control未显示/未遮挡且下拉offset>0或filled时绘制。松手添加/移除仅accessibilityText，不画文字。目录bookmarks undefined不能推断为空，也不能写入；真实确认后回读。',
      '胶囊tts preparing/playing/paused和auto playing/paused，点击只onToggle暂停/继续；准备期只desiredPlaying。控制层仍正文中部tap打开，停止在原模块；翻页输入非idle忽略toggle，controlVisible/obscured/block/exit/未ready不展示胶囊。',
      '单次页面提交与显示交接分别门禁，旧 generation/内容版本/书籍身份的回调失效；退出/换源/设置重新分页不能复用过期位置。',
    ],adaptation:[...adaptation,'移植适配：iOS/Android 文字测量必须使用同一字体文件、lineHeight、scalar边界和图像几何；测量结果不同应保留精确锚点重新分页，不能机械复用 HarmonyOS 页号。'],
    sources:[r('ReadingSurface.ets',346),r('ReadingSurface.ets',395),r('ReaderLayoutGeometry.ts',238),r('ReaderAppearanceState.ts',87),r('ReaderAppearanceState.ts',157),c('ReaderTypography.ets',284),r('ReaderPageGestureState.ts',55),r('LocalReadingExperience.ets',13644),r('ReaderTextSelectionPolicy.ts',22),r('ReadingSurface.ets',226),r('ReaderTextSelectionProjection.ts',2),r('LocalReadingExperience.ets',5889),r('LocalReadingExperience.ets',12461),r('LocalReadingExperience.ets',12489),r('ReadingSessionFlowGateway.ts',996),r('LocalReadingExperience.ets',12179),r('LocalReadingExperience.ets',2113),r('ReaderPageGestureState.ts',305),r('ReaderPageTurnStage.ets',311),r('ReaderPageTurnStage.ets',370),r('ReaderPageChromeLayout.ts',188),r('ReaderSessionCapsule.ets',123),r('ReaderSessionCapsuleModel.ts',33),c('ReaderTypography.ets',293)],
  },
  directory: {
    layout:[
      '小说详情独立目录实际入口是Index挂载BookDirectoryPage.standardPage：58vp PageBackBar“目录”在y0；没有书名/章节topbar、抓手、阅读sheet、书签tab、当前章节footer、换源或离线菜单。小说LocalReadingExperience未调用onOpenDirectory；漫画空目录fallback有guarded ReaderFullDirectory路由，不能与详情页或小说Full模块合并。',
      'contentFrame=resolveHorizontalFrame(W,safeLeft,safeRight,new SurfaceWidthSpec(720,20,20,center))；工具区x=frame.left/y58。Toolbar50高，paddingX10/top9/gap5，field32高、4工具槽32×32/16icon/r8；Column末尾1divider，实测toolsHeight动态预算列表。',
      '列表同frame宽，row40/r6/listPaddingX10/Y0，contentStartInset=58+toolsHeight+5，contentEndInset=max(12,safeBottom)+5。currentChapterIndex=−1，无current highlight；空态14fp居中，top padding58+toolsHeight+20。query非空且原目录有数据为“没有匹配的章节”，否则catalogMessage或“暂无章节信息”。',
      '真实目录矩阵：小说详情standardPage、ReaderControlDirectoryContent Quick/Full；漫画详情mangaPage、MangaReadingSurface phone章节sheet/wide右面板/左常驻catalog，以及空目录fallback允许的ReaderFullDirectory。Core树身份共用，视觉宿主和能力门控分别保留。',
      'Core v2 group标题/34×rowHeight箭头（18fp ⌄/›）折叠；target须真实chapterIndex/offset/proof才能跳转；disabled文字READ_MUTED，无下载/书签。zero-based depth映射level=depth+1，缩进min(3,level−1)×12。unknown离线不画download，bookmarks undefined不画marker；marker15图配26×40槽，仅图标。',
      '本书层级规则仅sourceId=local && bookKind trim/lowercase为txt/local && Core reading.directory.view.v2。点击按钮展开原tools区，bodypadding10/gap8，标题14Bold/说明11；原说明是产品文案，不是设计备注。无独立规则页。',
      '规则pattern输入40高/12fp，下一行gap8：层级11+64×40输入+原生Select（已有标题/章首独立行/章尾独立行/独立行边界）+删除。规则Scroll=min(240,ruleCount×94)；添加/预览/应用原Button，message11。预览最多256nodes、Scroll120高/11fp；规则上限32、整数层级0–31。',
      'loading/load-error/unavailable/editor/empty/preview/busy/error/applied都在展开区。读取失败“当前规则读取失败，请关闭后重试”；格式拒绝“层级规则适用于 TXT；本书使用格式自带目录”；预览失败“规则预览失败，现有目录保持原样”；apply成功“目录层级规则已应用，正文和分章保持原样”。样例node统计为占位。',
    ],typography:[
      'PageBackBar title NotoSerifSCBold700/24fp/33，Back44×44/24icon，两侧safe最少20。章节NotoSansSC500/11单行省略，Core组/target同字体，disabled只换颜色。',
      '规则Select/添加/删除/预览/应用为HarmonyOS原生控件，源未定义全部字体/r/minWidth；网页相似外观不能当精确跨平台交付值。',
    ],behavior:[
      'openFullDirectory只在route=detail&&!readingSessionActive&&detailBook存在&&无书架移除操作时允许；当前详情独立页选章开始本次阅读壳，正文可用不是进壳前置条件。onDirectoryChapterSelected另有active-session/current章分支，但当前detail入口不能冒充reader独立目录路径。返回详情，无Quick→独立页入口。',
      '查询/排序/边缘定位保留同List owner/Core原index；新identity重建key，旧row callback核对mounted/admittedIdentity/data snapshot/navigable。用户Scroll取消待placement。group只折叠，disabled不发target请求。',
      '规则get/preview/apply携bookId+generation+mounted shouldCancel；编辑/添加/删除令previewReady=false并丢旧预览，不能应用旧结果。apply要求loaded&&!busy&&previewReady；preview要求loaded&&!busy。busy禁三个操作按钮，输入/边界编辑依源码仍可使请求失效；返回页/收起规则无busy guard，离开取消发布。',
      '规则只调整导航层级，Core处理正则和边界，不改变TXT正文/分章；删除全部规则仍先preview再apply恢复默认。onApplied增加rulesRevision重投影。小说standardPage章行下载仅missing/cached/failed/cancelled可发；completed禁用，undefined书签不画marker。漫画已保留话仍能打开下载管理。',
    ],adaptation:[...adaptation,'移植适配：保留详情目录与阅读控制两种owner；维持真实target proof、正文/分章保护、Core规则预览与失效机制。'],
    sources:[i(1516),i(4620),i(4515),b('BookDirectoryPage.ets',127),b('BookDirectoryPage.ets',170),b('BookDirectoryPage.ets',547),b('BookDirectoryPage.ets',681),r('ReaderDirectoryToolbar.ets',41),r('ReaderDirectoryRules.ets',41),r('ReaderDirectoryRules.ets',88),r('ReaderDirectoryRules.ets',181),r('ReaderDirectoryNavigationList.ets',671),r('ReaderDirectoryChapterRow.ets',30),c('PageBackBar.ets',32)],
  },
  'reader-controls': control({
    layout:[
      'quick/local：首页稳定 Quick，不提供首页 Full 内容。Home主栏190高+brightness38×190，主栏右边距14；内容左12.44/right13.56；首页章节卡108.563+gap6+快捷卡75.438。',
      '章节行含上一章/章名/下一章，progress0–100 step0.1；快捷动作搜索/自动翻页/替换，按钮55.438高、24icon、label13高。',
      '亮度1–100 step0.1；视觉track8宽、交互24宽，trackH=190-38-10-10-28=104；太阳20、自动pill20（hit24），上下control gap14。local换源opacity0.4/disabled。',
    ],typography:['快捷标签Inter800/11fp/13行高；Topbar维持公共文字角色，标题与候选内容不得混入审计备注。'],
    behavior:['进度拖动走原 owner 提交目标，不在每帧写进度。亮度每个changed MOVE即时交给window-wide合并writer，UP再次提交最后值；CANCEL只撤未发样本，等已发native写入ACK后投影，不承诺回拖前值。退出生命周期释放亮度owner。自动按钮切跟随系统。'],
    sources:[r('ReaderControlGeometry.ts',9),r('ReaderControlPanel.ets',1580),r('ReaderControlPanel.ets',1880)],
  }),
  'reader-directory': control({
    layout:[
      '小说quick/full、hierarchy、bookmark loading/empty/error/pending：同一控件、同一行身份；漫画另用MangaReadingSurface章节sheet/常驻目录与BookDirectoryPage漫画分支，不借用小说tab；tab真实名称“章节”“书签”。p=0 toolbar/footer隐藏；p=1工具52高、目录footer48高。',
      '章节行高32+8p、书签54+20p；章节listTop48+51p，书签47+52p。listH=max(0,availableH-listTop-(书签?1:1+48p))。',
      '章节左右padding16→10；书签15→10；rowWidth=max(0,availableW-2-2padding)。Tab高31→36，font11/line16、icon15、选中underline2高/52%tab宽。',
      '小说独立详情目录入口current=-1无footer；当前漫画详情目录按独立chapterIndex/pageOrdinal显示48高footer；Full控制目录footer有“当前章节”9fp、标题11/Bold、位置9；与独立目录不同。bookmark-empty/error/loading替换同列表viewport，不新增总反馈页面。',
    ],typography:['章节字11/500单行，bookmark标题11/14、位置/时间Inter9、摘录Serif9/14两行、待确认8；仅本控制模块有书签tab；所有文字在形态变化时保持实际字体大小，仅box/位置重排，书签标题不缩放。'],
    behavior:['Quick/Full保留 leadingRow+fraction 滚动锚点；数据投影与视觉p分别更新。用户滚动取消 pending placement，新源/书籍/查询切换令旧定位ticket失效。','未完成目录按既有 onRequireCompleteCatalog补齐；下载/书签回读投影，当前行点击仍沿单一导航owner。'],
    sources:[r('ReaderControlDirectoryContent.ets',277),r('ReaderControlDirectoryContent.ets',391),r('ReaderControlDirectoryContent.ets',438),r('ReaderControlBookmarkGeometry.ts',22),r('ReaderDirectoryChapterRow.ets',30)],
  }),
  'reader-tts': control({
    layout:[
      'quick/playing/paused/error与Full播放/暂停/错误/准备、在线组合在同模块；Quick Playback66高、Timer42高、Speed42高，局部y=13/87/137。只有播放两行label、4 transport、不开启定时pill、语速值与track；当前音色/句子slider/错误文字opacity0。',
      'full/online/online-configured：Playback198高（seek额外32、error额外24）、Speed147.5高y234、Timer194高y401.5、Engine y615.5高238（online减48）、Detail y873.5（online减48）；seek extra让后续整体下移。',
      'transport Quick previous/stop/next28×28、toggle36×36；Full previous/next42×42、toggle58×58、stop57×21。图 previous/next14→26、toggle13→20、stop10；只有Full stop绘制“停止”。',
      'Full waveform宽=innerW-32/28高，当前音色16icon+11fp；totalSlices>1才有句子slider24高。Full播放配置音色52高、5开关+失败策略各48；原type定义session但没有主界面调用入口。',
      'Engine System/Online两个87高服务卡，20icon、16选中check、gap10；system卡下engine/language各48行；online仅服务信息48行，没有系统语言/引擎行。',
      'online未配：当前音色/音色值“尚未配置在线服务”，服务info“立即配置”，播放4按钮禁用。online-configured：音色“由在线服务提供”，服务info“已配置 · 编辑”，card副文案真实配置name。',
      'Full timer六preset（不开启/15/30/45/60分钟/本章结束）36高，custom48高含分秒stepper；speed5preset32高，默认1.00x，范围0.50–2.00 step0.05。',
    ],typography:['TTS使用NotoSansSC UI Regular/Medium/Bold角色。Quick播放13/10，Fullsection标题12Bold、status10Medium、speedmeta11Inter；服务标题12Bold/sub10；voicepicker值11；Full stop11Regular。'],
    behavior:[
      'activeQueue=preparing/playing/paused/resuming/interrupted；activelySpeaking=preparing/playing/resuming，三者toggle均显示pause。probing(探测)/completed/stopping/unavailable在原状态标签体现；previous/stop/next仅activeQueue允许，idle时opacity0.42，stopping时toggle禁用。只有真实 Host onStart ACK令准备态变playing，失败/paused feedback留在现有卡片。',
      '默认zh-CN/person0、followHighlight=true、pauseOnInterruption=true、allowMixing=false、backgroundPlayback=true、keepScreenOn=false、failure stop；全屏常亮/混音受系统音频能力控制。',
      '启动TTS先停止自动翻页，成功才把当前控制源组合收进session capsule；暂停/继续/停止以及 next/previous/seek 刷队列generation，旧requestId不可推进位置。',
      'System/Online服务卡只切serviceTab并留原模块；在线未配置时播放禁用，点服务信息才开管理。音色/引擎/语言/不可用处理值各带12chevron，voice含24徽章/30高pill；Quick timer pill含8×4chevron。四种值打开已有选择层；在线管理使用bindContentCover真实配置窗口，试听不是播放成功状态。',
    ],sources:[r('ReaderControlPlaybackGeometry.ts',46),r('ReaderControlTtsContent.ets',553),r('ReaderControlTtsContent.ets',616),r('ReaderControlTtsContent.ets',677),r('ReaderControlTtsContent.ets',832),r('ReaderControlTtsContent.ets',1099),r('ReaderTtsState.ts',5),r('ReaderTtsPreferencesState.ts',39),r('LocalReadingExperience.ets',7730)],
  }),
  'reader-tts-config': {
    layout:[
      'voice/voice-empty/voice-online/engine/language/failure：Full朗读模块临时层，透明outside层；普通选择宽min(260,availableW-16)，voice宽max(0,min(availableW-42,availableW-16))。右距普通13/voice21。',
      'voice无header；其他40高header+16close（28hit）。voice行54高，其他44高，左右12、gap10；头像34×34，试听44×36/r18，check11×9。',
      'panelH=max(44,min(header+choices×rowH+message80+manage44+error48,availableH-16))；anchor下面放得下时y=anchorY+2，否则y=anchorY-54-panelH；最终clamp8..availableH-panelH-8。radius14/border0.5/shadow36,y14。',
      'voice-empty使用已有message+管理在线TTS；voice-online无系统列表，音色语言由在线服务决定；engine包含system及当前配置服务；language从可用voice去重；failure只有停止并提示/跳过不可用内容。',
    ],typography:['voice名称13/17行高、语言10/14；其余choice12/17；选中Bold，其余Medium。Header12Bold，message12Regular；管理按钮12Medium/44高。'],
    behavior:['engine/language/voice/failure分别打开field，只在Full可达。选择先停止试听，onChoose置busy禁行/关闭按钮/管理，真实成功才close同identity，失败error留层。系统Back到达阅读owner时先dismissTemporaryRevision清临时层，即使普通选择busy也可清层；旧generation回调不能更新已卸载层。试听previewId同按钮变停止，Back直接关层并停止试听。管理窗口另有bindContentCover busy dismiss guard，不套普通选项层规则。关闭/选择/生命周期/配置identity变化终止 audition；preview generation拒绝旧error回调。','voice-empty并非下载音色页；session“音频会话”函数选项已定义但主页面无入口，此稿不新增。'],
    adaptation:[...adaptation,'移植适配：锚点取滚动后的真实配置行屏幕坐标；选择层不能固定在某个phone像素y，也不能被父Scroll裁掉。'],
    sources:[r('ReaderControlTtsContent.ets',176),r('ReaderControlTtsContent.ets',423),r('ReaderTtsConfigOverlay.ets',91),r('ReaderTtsConfigOverlay.ets',155),r('ReaderTtsConfigOverlay.ets',260),r('ReaderTtsConfigOptions.ts',23),r('LocalReadingExperience.ets',6138),r('LocalReadingExperience.ets',9980),r('ReaderControlTtsContent.ets',93),r('ReaderControlTtsContent.ets',167)],
  },
  'reader-tts-manager': {
    layout:[
      'new/edit/error/busy：真实window content cover底部居中，不是路由。外层左右13、上下padding=min(16,max(0,(usableH-44)/2))；maxW364；H=min(58+440+76,usableH-2padding)。',
      '固定header58、footer76，body Scroll；高度<=166时整表（包含header/footer）切单一Scroll，保存取消44点击尺寸仍保留。radius22、border0.5、shadow48/y18；scrim=#661F1B17。',
      '5字段服务名称/接口地址/API密钥/发音人或音色/格式；field42高/r10，列gap14、label与field gap6，bodypadding8/18/16。清除密钥在API field下面。格式MP3/WAV/PCM槽36高。',
      'edit只读回选中在线服务公开元数据，API secret输入仍为空；error保留draft并显11fp最多3行；busy输入、关闭、格式、清除、取消、保存全部禁用opacity0.42。',
    ],typography:['Header15Bold、labels11Medium、input13Regular（URL/key/voice用Inter）、placeholder13；格式11；footer13（保存Bold，取消Medium），error11Regular。'],
    behavior:['草稿只在保存后onPut提交，非空name/URL等验证通过才允许保存；真实成功才关闭，失败保留draft。取消/CANCEL/outside/back均不在busy中关闭；读取已有API密钥被禁止。','清除密钥只标记draftClearApiKey，保存前不修改secret；源有onDelete callback但当前managerForm无独立删除入口，此稿不造删除按钮。'],
    adaptation:[...adaptation,'移植适配：键盘出现时按剩余usableHeight resize并滚动；恢复原键盘avoid策略。iOS sheet/Android dialog须维持busy dismiss guard及固定footer预算。'],
    sources:[r('ReaderControlTtsContent.ets',432),r('ReaderTtsConfigOverlay.ets',59),r('ReaderTtsConfigOverlay.ets',91),r('ReaderTtsConfigOverlay.ets',131),r('ReaderTtsConfigOverlay.ets',289),r('ReaderTtsConfigOverlay.ets',347)],
  },
  'reader-appearance': control({
    layout:[
      'quick/full：主题8项4列，日间/暖白/夜间/暖夜/纸纹/青叶纹/靛夜/林夜纹；每个persistent root62.5×24，内部色块46×18，offset8.25/2，圆角6，selected边2，否则1。Full外shell高58.8/gap6，Quick row stride28，Full64.8。',
      'Full sectionW=fullViewportW-22；theme cellW=(sectionW-22)/4。主题extraRows=max(0,ceil(themeCount/4)-2)，额外Quick28/Full64.8逐行扩高。',
      'font顺序9槽：系统/宋体/黑体/楷体/仿宋/等宽/思源宋体/霞鹜文楷/导入。常规Quick高27、Full30；Quick4列gap4/row31，Fullgap8/row38；import仅Full显示可点，不占Quick可点入口。',
      'Full字体按钮radius12，selected底色PRIMARY/不画border；import边虚线。字号/行距/段距/字距、缩进、简繁布局库仅Full；日夜默认按钮74×28/9fp。',
    ],typography:['Quick主题标题9/9.9，summary7.5/8；Full标题12/17、summary9/13，主题标签9/13。字体预览实际family12fp，不能把Quick标签压成8fp。'],
    behavior:['主题即时应用并异步保存；字体注册准备成功后按原scalar位置重新分页。设置默认日夜只更新对应选中theme，不造结果页面。','font Full长按160ms开始reorder，拖动直接跟手，邻居120ms、落位160ms；cancel恢复原order，不提交。导入由原系统选择器验证TTF/OTF后注册。','缩进无/1字符/2字符与简繁原文/繁转简/简转繁各打开真实选择层；不是常驻三段button。任何临时选择/字体拖动时禁用原Scroll。'],
    sources:[r('ReaderControlAppearanceGeometry.ts',60),r('ReaderControlAppearanceGeometry.ts',115),r('ReaderControlAppearanceContent.ets',373),r('ReaderControlAppearanceContent.ets',451),r('ReaderControlAppearanceContent.ets',600),r('ReaderControlAppearanceContent.ets',748),r('ReaderControlAppearanceContent.ets',932)],
  }),
  'reader-settings': control({
    layout:[
      'quick/full：屏幕方向3项（跟随系统/竖屏/横屏），翻页样式5项（仿真/覆盖/滑动/滚动/无动画），超时5项（跟随系统/1分钟/5分钟/10分钟/始终开启）。',
      '屏幕组origin15/5；Quick label y18+54i、248×12，bar y35+54i、248×30；Full label y37+72i、150×16，bar y61+72i、308×33；宽差由actual availableW扣 canonical286→338后补入。',
      '3选项Quick x3/84/166、79×24；Full x3/104.66/206.32、98.66×27。5选项Quick x3/52/101/149/198、47×24；Full x3/64/125/186/247、58×27；按宽差重新分配。',
      'Full新增导航状态栏/排版/控制，parent y263/394/525、height131/131/169，row38高。Quick不绘制新增组，Full children opacity与parent相乘为p²。',
    ],typography:['组title11/16、label10→11/对应label高度，segment9单行居中；toggle label NotoSansSCMedium11/16。'],
    behavior:['默认跟随系统方向、paged+slide、system超时；hideNavigation=false、extendIntoCutout=false、alignPageBottom=false、volumeKeys=false、stopTtsOnScreenOff=false、longPress=true。justifyText由appearance实际alignment掌管，settings兼容字段默认false不另造owner。','platform unavailable的仿真选项禁用；滚动选择改变navigationMode，其他改变paged transition，需保护原锚点。方向、刘海和导航设置更新真实窗口metrics并按原锚点重排。'],
    sources:[r('ReaderControlSettingsGeometry.ts',52),r('ReaderControlSettingsContent.ets',172),r('ReaderControlSettingsContent.ets',247),r('ReaderSettingsState.ts',128)],
  }),
  'reader-search': control({
    layout:[
      'Quick与Full各自覆盖idle/results/loading/empty/error/more-loading/more-error/complete，局部choices的查询与加载状态不依赖形态：状态在原Resultsviewport，输入+搜索row不移出；无额外全屏成功/错误页面。query空时提示输入，loading正在搜索，error真实动态错误。',
      '源field Quick(64.55,-17.45,167,24)→Full(10,9,277,32)，source basisX=2-.448(1-p)、basisY=2+28.443(1-p)，宽差actualW-(286+52p)补到field和action。',
      'action Quick36×24→Full32×32，16icon；radius8/border1。Quick返回51×24、11icon，仅Quick有：Row gap4、仅左padding8，Inter70010/AUTO，primary文字、PANEL_SOFT底色；图标与标签不压缩、标签单行。Results开始于queryBottom+1，不保留旧Full空白带。',
      '结果row54→72高、borderRadius6；chapter标题11/13.2最多单行，excerpt9/13.95、28高；next batch按钮112×26/r8，loading“正在加载…”、错误“加载失败，重试”、可用“加载更多结果”。',
    ],typography:['Input NotoSansSCRegular10fp/AUTO行高；结果文本与按钮遵上述独立字体，不从大标题继承。关键词用原高亮色。'],
    behavior:['提交query/version/book scope请求；新query/owner/lifecycle使旧publication失效，回调不能混入另一章文本。loadingMore禁重复按钮。','跳搜索结果核对source/book/chapter/offset/body版本后提交，目标读取/测量/存储完成前不移走原阅读。'],
    sources:[r('ReaderControlSearchGeometry.ts',24),r('ReaderControlSearchContent.ets',363),r('ReaderControlSearchContent.ets',481),r('ReaderControlSearchContent.ets',504),r('LocalReadingExperience.ets',2264)],
  }),
  'reader-autopage': control({
    layout:[
      'quick/running/paused及Full对应状态：原Quick挂载24高自动翻页/状态header、控制按钮行与速度减/当前/加，timer wheels与Full配置不显示。quickBack虽然定义，但normalContent/launchSourceContent均未调用，因此没有Quick返回按钮；返回沿系统Back/控制导航。stopped stop disabled/opacity0.4，running暂停icon，paused继续icon。',
      'full：content section高度104.39/181.39/149.39，total435.17；Full body design336×665 at14/58，内部content314宽。Timer card138高/r10，wheel34行高、114总高、neighbours1。',
      '默认timer15:00、speed8秒、followHighlight=false；分钟0–180，秒0–59，speed2–20 step1。WheelW=max(0,(sectionInnerW-115-15-24)/2)，右wheel x=wheelW+24，中间colon8×22/18fp。TimerWheel仅邻值点击选择，没有滚轮Pan/惯性/吸附。unit8高/8fp，selected两条1vp边线。',
      'Full speed显示标题/当前值与2–20 slider；Quick显示minus/plus24×24且无slider。Fullslider track4、thumb14；followHighlight开关Full-only。',
    ],typography:['控制section titleInterBold12、status10；prev/next/自动翻页/停止标签Inter9/9行高；speed title/current11→10，current weight900→400；wheel选中17/邻11。'],
    behavior:['开始先停止TTS并等待stop barrier，未停下只原Toast反馈且不启动；running→pause保存剩余页/会话时间，resume从剩余重新定时；stop取消page/session timer与pendingstart并提升generation。','setSessionTimer/followHighlight仅stopped接受；setSpeed running时重置下一页deadline。awaitingPageCommit期间不发第二次自动翻页；边界EOF停止，同原手动页面commit门禁。'],
    sources:[r('ReaderAutoPageFullState.ts',8),r('ReaderAutoPageMotionGeometry.ts',14),r('ReaderControlAutoPageContent.ets',305),r('ReaderControlAutoPageContent.ets',430),r('ReaderControlAutoPageContent.ets',514),r('ReaderAutoPageCoordinator.ts',50),r('LocalReadingExperience.ets',8249)],
  }),
  'reader-replace': control({
    layout:[
      'ReaderControlReplaceContent是原控制栏的一个viewport，底TOK_SURFACE_PANEL、TOK_LINE边框/r12；Quick/Full始终挂载同一完整rule集合，不另开管理页面。Quick只显示固定三行窗口投影，原生禁止用户滚动；Full才允许列表滚动，临时层打开时暂停底层列表滚动。缩短窗口仍按实际availableHeight裁切，不保证三行都可见。',
      '替换模块头是viewport的兄弟，wrapper30高且始终可见。Quick题“替换规则管理”位于header-local(66.55,29.55)/208×14；图标与完成动作opacity0。Full标题(25,7.5)/84×17、16图标(1,8)、完成40×26位于(headerWidth−41,3)/r8/TOK_READ_ACTIVE_SOFT；完成只在p=1启用并收回Quick。标题70014/16.8，完成70010/AUTO。',
      'Quick返回在viewport-local(10.1,14.55)，51×24/r8/TOK_SURFACE_PANEL_SOFT；11返回icon在文字前，Row gap5/居中/无padding，NotoSansSC70010/AUTO、TOK_READ_PRIMARY。Full返回actor移到y28.55并隐藏；不套搜索返回的左padding8。',
      'Full toolbar在viewport-local(14,14)，宽availableWidth−28、高40；新增/导入/导出之间gap8，三项宽权重100.66/96.67/96.67。每项icon20在11Bold文字前、内部gap6/居中/r8；新增底TOK_READ_PRIMARY/白字、其余底TOK_READ_ELEVATED/TOK_READ_INK字与TOK_LINE边框。Quick toolbar隐藏。',
      'List Quick x17.55/y47.55/宽availableWidth−36/高max(0,availableHeight−106)，普通190高viewport给84高三行窗口；Full x14/y64/宽availableWidth−28/高max(0,availableHeight−77)，只列表内滚动，toolbar不随滚动。row高28→77、行间距0→7、padding5→13，底TOK_READ_ELEVATED/TOK_LINE边框/r8。',
      '规则行按actor坐标排布：开关x=rowPadding并在rowHeight内垂直居中；名称x=rowPadding+toggleWidth+10、y=5.5+5.5p、高17、宽max(0,listWidth−2rowPadding−toggleWidth−10−75p)，70012/AUTO单行省略。Full pattern/meta列同名称x、y32、宽max(0,listWidth−155)/高34/内部gap4；pattern9/TOK_READ_MUTED，scope摘要8/TOK_READ_PRIMARY，均单行省略，Quick隐藏。编辑/删除各30×30/r6/20icon，内部gap5，组宽65位于(listWidth−78,(rowHeight−30)/2)，仅Full显示。',
      '规则开关Quick27×16/thumb12、Full44×24/thumb20；thumb离边2，off x2、on x=trackWidth−2−thumbSize、垂直居中，不叠加flex末端定位与translate。轨道无边框，active TOK_READ_PRIMARY；规则thumb为纯白，off用app.ReaderControlReplaceContent.ruleRow.paint.FFC9C5BE（日#C9C5BE/夜#5C6065）。',
      'Quick footer位于(17.55,145)，宽availableWidth−35.1/高28，预览效果/完整管理各layoutWeight1、gap6；按钮28/r6/paddingX6/TOK_READ_ACTIVE_SOFT/TOK_READ_PRIMARY。Full列表尾部另有32高Row承载28高“预览当前章节已保存规则”按钮，随列表滚动；不把32容器高度当按钮高度。',
      '列表无规则或有errorMessage/localError时statusContent在原列表中，Column gap4/minHeight76/垂直居中；状态10/TOK_READ_MUTED/maxLines3，错误带原操作的28高核对按钮。已有规则伴错误还在列表顶叠放height=min(84,listHeight)的TOK_SURFACE_SOLID/r8状态块，规则集合继续保留。单独mutationPending只禁用相关动作，不新增列表外等待状态条。',
      'editor/delete/import-confirm/preview覆盖当前module viewport：ReaderBoundedSurface宽高等availableWidth/Height、padding12/r12/TOK_SURFACE_SOLID；Column gap8。Header28/内部gap8、13Bold标题layoutWeight1；editor前置38×28纯文字“返回”11/AUTO居中/TOK_READ_PRIMARY，无icon；其余在标题后有28高取消textAction。Body为剩余高度的独立Scroll、Column gap8，底层列表锁滚动；只有editor有36高footer，取消/保存各layoutWeight1、gap8/r6/11。',
      'editor含8个单行字段：名称/匹配内容/替换为（可留空）/分组/包含书名与书源范围/排除范围/排序/执行超时。label10/TOK_READ_MUTED，字段36/r6/11/TOK_READ_INK、TOK_SURFACE_PANEL_SOFT底/TOK_LINE边框；label-input gap3。5项flag行32高/gap10/无额外行分隔线，label12/TOK_READ_INK，默认44×24/thumb20开关，thumb TOK_READ_ELEVATED、off日#AAA39A/夜#5C6065。取消footer底TOK_SURFACE_PANEL_SOFT；保存底TOK_READ_PRIMARY/白字。',
      '新增draft沿state.defaultScope、order=末条order+1（无条目0），默认启用/正则/正文=true，标题/书源导入=false、timeout=3000ms；编辑回填被选规则的全部字段。删除文案使用被选规则名，导入确认保留合并说明，预览body显示真实chapterTitle、stored/enabled count、可选“仅展示截取片段”、替换前/后。错误11/TOK_READ_MUTED、pending11“正在等待确认…”与未知原操作核对按钮均留在本临时层，不增设成功页。',
    ],typography:['NotoSansSC：persistent标题70014/16.8；rule name70012/AUTO；toolbar70011/AUTO；pattern9/AUTO、scope8/AUTO继承字重；Full完成和Quick返回70010/AUTO。临时层标题70013/AUTO；body/flag/预览章节与正文12/AUTO；label/count/helper10/AUTO；input/返回/操作/错误/pending11/AUTO；替换前/后标签70011/AUTO。当前仅源码和稿件结构对照，不构成原生视觉验收。'],
    behavior:[
      'readyInput仅在稳定Quick或Full、status=ready且无mutationPending/localPending/writeBlocked/writeUncertain/canonicalReloadRequired成立。所有rule toggle/preview沿此门禁；新增/编辑/删除/导入/导出额外要求Full，Core确认前不乐观移除规则或显示保存成功。Quick完整管理只要求Quick且无state.mutationPending，触发同owner展开。',
      'Quick预览直接preview()而不展开，Full预览也覆盖当前viewport；关闭恢复来源形态。预览只使用已保存规则，章/书籍/selection或presentation变更令旧结果失效。保存/删除/导入正常完成才清临时层；导入先系统选择文件，同ID合并覆盖、其他集合不变，取消文件选择不提交；导出使用系统保存位置。',
      '临时层按钮取消/返回仅在无localPending/state.mutationPending时启用。输入要求Full且无pending/writeBlocked/writeUncertain，flag及保存/确认动作另要求readyInput。未知写入通过operationId/原回执核对，普通列表回读不证明未知写入失败，不重复提交；核对保留原editor及draft。',
      '应用接收系统Back时先消费实际IME，再在controlTemporaryLayer可见时增加dismissTemporaryRevision并清层，忙时也清层；已发Core写入不会因清层而宣称撤销。没有临时层时Full返回收Quick，Quick返回home，home再关闭回正文。展开/收起离开稳定端点也清临时层，sessionKey变化清层并重置列表scroll；旧presentation回调不得回写新层。独立rules-management callback没有当前模块调用，不增加入口。',
    ],
    sources:[r('ReaderControlReplaceGeometry.ts',30),r('ReaderControlReplaceGeometry.ts',48),r('ReaderControlReplaceContent.ets',170),r('ReaderControlReplaceContent.ets',191),r('ReaderControlReplaceContent.ets',228),r('ReaderControlReplaceContent.ets',245),r('ReaderControlReplaceContent.ets',289),r('ReaderControlReplaceContent.ets',340),r('ReaderControlReplaceContent.ets',352),r('ReaderControlReplaceContent.ets',375),r('ReaderControlReplaceContent.ets',433),r('ReaderControlReplaceContent.ets',451),r('ReaderControlReplaceContent.ets',472),r('ReaderControlReplaceContent.ets',489),r('ReaderControlReplaceContent.ets',507),r('ReaderControlReplaceContent.ets',540),r('ReaderControlReplaceContent.ets',547),r('ReaderControlReplaceContent.ets',582),r('ReaderControlReplaceState.ts',171),r('ReaderControlSwitchTrack.ets',13),r('ReaderControlPanel.ets',1178),r('ReaderControlPanel.ets',1434),r('LocalReadingExperience.ets',2278),r('LocalReadingExperience.ets',6132),r('LocalReadingExperience.ets',9979),r('LocalReadingExperience.ets',10287),r('LocalReadingExperience.ets',10303),r('LocalReadingExperience.ets',10319),c('ReaderBoundedSurface.ets',29),c('ReaderBoundedSurface.ets',83),c('ReaderBoundedSurfaceHeader.ets',42),c('ReaderBoundedSurfaceActions.ets',54),c('ReaderBoundedSurfaceActions.ets',103),c('ReaderControlSpecs.ets',319),c('ReaderFormField.ets',17),c('ReaderTypography.ets',216),c('ReaderTypography.ets',716),c('ReaderTypography.ets',727)],
  }),
  'source-switch': {
    layout:[
      '当前原生SourceSwitchWindow仍是全视口TOK_PAPER整页承载。本轮是用户授权的小说设计预览：同一HTML入口默认direct，可在direct / confirm / grouped三布局间比较；设计选择器属于预览工具，不进入应用画布。candidates/discovering/switching/empty/discovery-error/failure/failure-transaction保留同一书籍上下文和候选状态，三版接入不代表原生已实现。',
      '小说三版共用flat58平面导航：导航区58高，左44×44响应区复用现有返回箭头，标题“更换书源”，右侧44×44“重查”或“停止”；正文依owner已消费的safeTop避让，不重复添加顶部安全区。移除小说稿旧52高/r18浮动返回栏和close图标。漫画继续原52高/r18浮动返回栏、原关闭和重查动作。',
      '小说三版书籍信息共用48×72/r6书架列表封面与四字段：书名16/22SerifBold、作者12/17、最新章节12/17、当前书源12/17；gap12、padding水平18/顶12/底16，信息列自然高/min72/gap3并横向拉伸限制长文本。book.latestChapter兼容既有book.chapter，不读取reader-chapter-index；候选最新章节各自独立，未知保留“待解析”，不拿当前阅读章节补齐。信息区已列当前来源，候选最多展示7个不同的其他源，不重复加入当前source+book复合身份。四字段及源名/章节保留转义后的完整title。漫画继续原书籍信息和候选展示。',
      'direct：候选直接点选，两行自然高/min58，padding水平18/垂直8、rowspace8；首行来源14/20 Medium，次行独立“最新”与来源章节12/17 Regular，文字列gap3。右侧搜索耗时及状态12/18、列min48随字号增宽、chevron12；失败/超时与章节分开，错误用现有日夜TOK_DANGER色，异常候选保留重试。',
      'confirm：候选行保留两行/min58，以单选标记表达本次草稿选择；点行只选择，列表底部footer提供44高提交按钮，未选择或切换中禁提交。footer与列表都避让safeBottom，列表末项不能被提交区遮住。仅明确提交后进入switching，不额外增加成功页。',
      'grouped：按普通查找结果与读取异常分组，来源行自然高/min52；异常来源保留自身最新章节或“待解析”，单独显示失败/超时与重试动作。分组标签是本次结果状态，不显示速度等级、评分或可靠性结论。普通结果点选沿direct路线，异常重试留在本组等待结果。',
      '查找状态自然高/min28，字号放大向下扩展；13加载图标、12/18状态和11/16“搜索耗时”说明。数值表示书源搜索请求耗时，不宣称正文读取速度、首图速度或评分。switching保留候选，仅选中来源显示忙碌并禁其他选择；结果不确定/事务失败保留原恢复区域，发现为空也保留书籍上下文。',
    ],
    typography:['小说flat58导航复用Reader页标题和现有返回箭头；信息栏书名SerifBold70016/22，作者、最新章节、当前书源NotoSansSCUIRegular40012/17。三版候选来源NotoSansSC50014/20、最新章40012/17、搜索耗时及状态40012/18；漫画继续原标题18SerifBold/AUTO、信息栏21SerifBold与Regular12/AUTO及原候选样式。'],
    behavior:['小说设计预览默认direct；direct点候选直接进入原切换状态，confirm点候选只更新单选草稿、footer44提交后切换，grouped普通查找结果沿direct路线且异常组提供重试。三版保留同一书籍与候选身份，7个其他来源不含当前源；失败/超时仍可重试，不用未知最新章节或搜索耗时推断可读性。预览使用夹具，选单和状态变化不执行真实Core写入。','原业务路线仍为未入架获取候选详情、成功回目标详情并保留返回来源；已入架获取目标目录、匹配章节并提交、成功回阅读。当前源按source+book复合身份排除；最新来源章节独立读取，未知显示待解析，不随阅读位置改写。','原查找按sourceId+bookUrl复合身份增量发布或更新，输入期间暂停排序；停止保留已发现来源。当前预览的发现数据仍为夹具，不以三版接入宣称真实增量发现通过。采集失败在阅读原位反馈，提交或核对失败留列表；小说switching禁关闭，漫画继续准备可取消、commitStarted禁取消及原选章路线。事务失败沿原transactionId撤销，不新增首图验证或成功确认独立页。'],
    adaptation:[...adaptation,'小说三版设计预览：导航与操作响应区保留44×44，confirm底部提交高44；标题省略不挤出返回/重查，行高随字号自然增高，safeTop只消费一次，safeBottom同时约束列表和footer。漫画继续原展示；加载动效与浏览器稿不是原生验收。'],
    sources:[s('SourceSwitchWindow.ets',78),s('SourceSwitchWindow.ets',184),s('SourceSwitchWindow.ets',333),s('SourceSwitchWindow.ets',364),s('SourceSwitchWindow.ets',386),s('SourceSwitchWindow.ets',410),s('SourceSwitchWindow.ets',432),s('SourceSwitchWindow.ets',471),s('SourceSwitchWindow.ets',486),i(5017),i(5182),i(5451),i(5480),i(5509)],
  },
  'reader-more': {
    layout:[
      '用户指定重绘：共用漫画moreSheet壳。Phone从底部展示、顶部圆角22、阴影向上；抓手区30/条42×5、header40/标题18、右36×36关闭/18icon；内容左右18/下24、三行48高/r14/间距8。底部避让safeBottom。',
      '沿漫画稿尺寸门禁：W>=600或横向窗口用widePanel；右侧贴边、上下撑满、圆角0、左分隔线，宽度沿共享frame公式（240–340，窄窗上限320或85%）。header66/下间距17，关闭34×34；内容左右20（W<=700用16）/下22。宽面板不接管抓手下拉，也不为小说增加漫画常驻目录。内容超高时在面板内滚动。',
      'normal/download-busy均使用三项小说业务：书籍信息、刷新本章、下载全部章节；busy只改第三项“正在下载章节…”并禁用，本地书籍也禁第三项。不给小说增加漫画的换源/下载本话/移入书架等项目。',
    ],
    typography:['采用漫画moreSheet的phone标题ReaderMangaSans900/18/26、wide标题ReaderMangaSans600/15/24；操作ReaderNotoSansSCUIRegular/13/18、居中、行间距沿漫画稿8。底色与文字使用同一漫画sheet日夜色，小说独立跟随应用scheme，不被漫画阅读底色选择污染。'],
    behavior:['点击遮罩、关闭或phone下拉收起回原小说控制模块；弹层焦点与背景隔离和漫画sheet一致。动作均先关面板再执行原业务；书籍信息先串行退出保存，真实成功才去详情；保存失败仍原退出失败Alert。刷新同章scalar、下载原队列+Toast，不新增成功/取消确认页。'],
    adaptation:[...adaptation,'样式调整记录：当前HarmonyOS源码ReaderControlPanel仍bindPopup；这里是用户明确要求的稿件重绘，不宣称原生已变更。phone下拉采用现有单向sheet适配，release稳定端点，未声称ArkUI spring已验收。'],
    sources:[r('ReaderControlPanel.ets',1062),r('ReaderControlPanel.ets',1068),r('ReaderControlPanel.ets',1078),r('ReaderControlPanel.ets',1539),{path:'entry/src/main/ets/features/manga/MangaReadingSurface.ets',line:1792},i(4773),i(4796)],
  },
  'reader-exit-failure': {
    layout:['normal：已有系统showAlertDialog title“阅读进度尚未保存”；message“请重试保存后退出。当前阅读位置已保留。”，primary重试保存并退出/secondary继续阅读；dialog无源码固定尺寸。'],
    typography:['系统默认AlertDialog typography，不使用demo通用dialog CSS尺寸当native值。'],
    behavior:['失败保持当前阅读位置、重启record clock；取消与继续阅读均取消Host one-shot exit destination。重试只本次持久化退出屏障，真实成功才调用onExit，late回调通过exitAttemptGeneration核对。'],
    adaptation:[...adaptation,'移植适配：系统返回/交互关闭必须走相同continueReading，不能关闭模态后仍执行旧pending route。'],
    sources:[r('LocalReadingExperience.ets',6239)],
  },
  'reader-refresh-failure': {
    layout:['refresh/jump：标题“刷新本章失败”/“跳转失败”，动态failureCode/detail，重试/关闭提示。','cache-verify：标题“需要重新验证本章缓存”，message=error.message，autoCancel=false，刷新本章/保留缓存并返回。','position-restore：标题“阅读位置恢复失败”，message“正文规则已更新，阅读位置尚未确认。请重试恢复。”，confirm重试恢复，autoCancel未显式设false。','progress-unknown：标题“正在确认阅读进度”，message“暂时无法确认保存结果。页面已保留，确认完成后继续翻页。”，autoCancel=false，primary重新确认。','page-recovery：标题“正在恢复页面”，message“阅读位置已保留，可以重新显示当前页面。”，autoCancel=false，primary重新显示；都是原系统Alert，源未固定窗口宽高/r/字体。'],
    typography:['系统默认Alert排版；网页system-dialog外观仅评审近似，动态error.message是样例。'],
    behavior:['刷新/跳转重试核对pending ticket与书籍/目标/context/refresh标记，过期不执行；失败保持原页和控制模块形态，关闭提示允许重选。','缓存实际入口：RemoteChapterCacheRefreshError→openChapter catch，仅!error.refreshPreserved&&!refreshContent才requestCachedChapterRefresh；刷新accepted核对selection后以refreshContent=true重开同章/context；保留缓存并返回resolve(false)后beginExit，仍需退出保存保护。','规则变更恢复实际入口：替换保存/启停/删除后的Local:10484及简繁保存后:9073→reloadMigratedContentPosition；仅同source/book/lifecycle/selection有效且进度读取失败/非restored才Alert。重试读取Core映射后的anchor/版本，不套旧数字offset。','进度核对实际入口：prepared非ordinary的Local:12699持久化观察unknown→12753；核对prepared/lifecycle/settlement及本generation未通知，reconciliationPending禁重复。重新确认串行读回核对目标/原anchor，未知不重复写；合格ordinary分支不走此Alert。','页面恢复实际入口：仿真watchdog slots未确认/surfaceHidden/logicalPromoted→requestBookTurn2DFallback；mounted&&!exitRequested&&settlementActive&&generation有效，立即fallback仍不能完成才Alert。重新显示只操作当前generation，保留terminal/位置，不导航新页。'],
    adaptation:[...adaptation,'移植适配：cache/progress/page三类autoCancel=false禁止outside/Escape直接关闭；其他沿系统默认取消。保留原业务generation，关闭模态不能伪造成功。'],
    sources:[r('LocalReadingExperience.ets',4239),r('LocalReadingExperience.ets',4254),r('LocalReadingExperience.ets',8755),r('LocalReadingExperience.ets',10240),r('LocalReadingExperience.ets',10565),r('LocalReadingExperience.ets',11250),r('LocalReadingExperience.ets',12461),r('LocalReadingExperience.ets',12528),r('LocalReadingExperience.ets',7041),r('LocalReadingExperience.ets',12779)],
  },
};

export const motionSpec = [
  {
    id:'reading.control.visibility',label:'控制层打开与关闭',origin:'当前主线 ReaderControlRuntime + 单一视觉时钟',
    trigger:'正文中部tap打开，outside有效tap/返回/关闭请求收回。outside tap时间<500ms、移动<8vp；必须down与up皆位于真实rounded dock/topbar外。',
    properties:'共享visibility v；topbar translateY=-8(1-v)、opacity=v；dock translateY=18(1-v)、opacity=v。关闭冻结当时expansion p及模块内容，组合变换施于父层一次。',
    duration:'open220ms / dismiss200ms / restore220ms；中途retarget按剩余视觉距离压缩时间，旧更短continuation不加长。',
    curve:'open/dismiss cubic-bezier(0.2,0,0,1)；触摸接管不ease。',
    interruption:'同pointer down暂停clock；重开从关闭capture恢复，被关闭中断的morph在恢复到capture后接续原phase。epoch/ticket/lifecycle不匹配frame无效。outside CANCEL不关闭。',
    reducedMotion:'show/dismiss/morph timing=0，接收逻辑目标立即取终态；真实pointer动作和业务提交保护仍保留。',
    sources:[c('ProductMotionTiming.ts',2),r('ReaderControlMotionGeometry.ts',9),r('ReaderControlPanel.ets',717),r('ReaderControlSessionState.ts',234),r('LocalReadingExperience.ets',10062)],
  },
  {
    id:'reading.control.morph',label:'Quick 与 Full 同模块形态',origin:'当前主线 sampleReaderControlMotionComposition + MotionPolicy',
    trigger:'secondary抓手tap（无方向移动，UP-down<500ms）、Full收起/完成、accessibility展开/收起、拖动放手。模块navigate当前duration0。',
    properties:'p统一采样shell、header/content/brightness/nav；shell高度Quick→Full、content y29→57、宽差52；nav y+20/opacity1-p，brightness向右移出/opacity1-p。文字不整体scale，data/list/scroll identity保留。',
    duration:'LocalReadingExperience.controlTiming初始morphDurationMs320；ReaderControlPanel coordinatedMotion=true且settleDuration>0，ReaderControlRuntime.timedCommand→MotionPolicy给expand nominal320ms / collapse nominal260ms，按实际目标距离裁短且不加长更短continuation；navigate0ms。不能把历史MotionSpec reader.module.switch360ms或shell420/360ms当现行调用。',
    curve:'自动morph p=t²(3-2t)；morph内部actor几何线性采样同p，不重复ease。内容clarity=smooth(|2p-1|)，opacity=.35+.65clarity，blur=2(1-clarity)。',
    interruption:'抓手重按取实际发布p，方向逆转同路径可逆；非稳定端点停用module业务输入，p=0/p=1才启用相应原控件。切模块回调只改module，保留opening clock。',
    reducedMotion:'nominal0，无自动几何中间帧；仍保留同owner业务与列表身份。',
    sources:[r('ReaderControlMotionGeometry.ts',103),r('ReaderControlMotionPolicy.ts',10),r('ReaderControlMotionPolicy.ts',55),r('ReaderControlMotionPresentation.ts',27),r('ReaderControlRuntime.ts',187),r('LocalReadingExperience.ets',9939)],
  },
  {
    id:'reading.control.drag',label:'抓手跟手、反向与速度接续',origin:'当前主线 ReaderControlGestureDriver',
    trigger:'单pointer屏幕坐标raw down/move/up；方向确认abs(y-anchor)>8vp；持续运动可跨两段Quick/Full/hidden路径。',
    properties:'以真实grabber屏幕Y映射空间p，无EMA/弹簧；超过边界的blockedDelta保留，反向先消耗该残差才回到路径。位置布局变更只rebase axis与velocity，不重置当前sample。',
    duration:'release T=nominal×abs(targetProgress-currentProgress)/(1+abs(vY)×nominal/(1000×segmentTravel))；vY为最后两MOVE差/时间×1000，UP间隔按sampleInterval/(sampleInterval+UPgap)衰减。',
    curve:'release continuation ((m-2)t+3-2m)t²+mt，m clamp0..3，起始速度匹配、终点速度0；pointer-owned帧不自动advance。',
    interruption:'最近确认方向选destination，非“过一半才完成”；CANCEL不是tap/fling，恢复down前目标与剩余duration；跨segment后用实际sample重建原逻辑目标。新command提升epoch并使旧gesture不再有owner。',
    reducedMotion:'automatic continuation=0；手指空间采样仍同路径。',
    sources:[r('ReaderControlPanel.ets',512),r('ReaderControlGestureDriver.ts',141),r('ReaderControlGestureDriver.ts',238),r('ReaderControlGestureDriver.ts',274),r('ReaderControlMotionPolicy.ts',47),r('ReaderControlRuntime.ts',117)],
  },
  {
    id:'reading.control.scroll-anchor',label:'展开收起中的列表与滚动保护',origin:'当前主线各目录/书签/搜索/替换/外观共享 morphScroll + clipping',
    trigger:'Quick/Full且Full列表已滚动，目录projection结果/书签结果延迟发布或窗口重排。',
    properties:'保留leading row+fraction与FullScrollOffset；当前viewport/clips与actor几何使用同p，native Scroll补偿不让离屏内容穿越可见区域；目录行32→40、书签54→74。',
    duration:'无独立动画duration；使用控制morph的p。projection、bookmark loading与实际layout到达时间由数据决定。',
    curve:'空间插值同控制p，row/title字体不scale。',
    interruption:'用户滚动立即取消pending自动placement；source/book/query/tab/sessionKey变化使旧定位票据失效；本地列表投影和chapter/bookmark请求分别门禁。',
    reducedMotion:'形态直接终态，但定位与列表身份保护保留。',
    sources:[r('ReaderControlDirectoryContent.ets',166),r('ReaderControlDirectoryContent.ets',277),r('ReaderControlBookmarkGeometry.ts',22),r('ReaderControlMorphScroll.ts',1),r('FullDirectoryPanel.ets',1148)],
  },
  {
    id:'reading.font.reorder',label:'字体拖动排序',origin:'当前主线 Full 外观字体库，产品补充交互',
    trigger:'Full已就绪font cell单指长按160ms，rawMOVE改变held中心，按当前4列网格计算dropIndex。',
    properties:'held直接跟手；其它cell位移track从实际当前position起，Full cell列距(width+8)、row38；grid drop取中心，clamp合法slot0..count-1。',
    duration:'邻居shift120ms；release/取消settle160ms；held没有跟手动画延迟。',
    curve:'邻居与settle cubic-bezier(0,0,.58,1)；按monotonic frame采样 MotionPointTrack。',
    interruption:'CANCEL恢复原order且不提交；正常up只有order变化才onFontOrderChange。新motionGeneration清除旧track；离开Full、打开临时层或生命周期取消拖动。',
    reducedMotion:'不创建位置track，立即放到目标grid；业务order仍仅正常release提交。',
    sources:[r('ReaderControlAppearanceContent.ets',132),r('ReaderControlAppearanceContent.ets',633),r('ReaderControlAppearanceContent.ets',810),r('ReaderControlAppearanceContent.ets',901),r('ReaderControlAppearanceGeometry.ts',145),c('MotionSpec.ets',72)],
  },
  {
    id:'reading.page.gesture',label:'阅读手势仲裁与书签预览',origin:'当前主线 ReaderPageGestureState / LocalReadingExperience',
    trigger:'正文touch；horizontal absX>=8vp优先，absX<8且up>=24vp previous，absX<8且down>=48vp bookmark；longPress>=500ms且最大二维移动<8vp。',
    properties:'paged displacement随raw坐标；page progress=min(1,absX/W)。bookmark offset=min(H/2,down/2)，preview有效需peak>=48且currentDown>=peak/2。tap前三分之一previous、后三分之一next、中间control。',
    duration:'跟手无固定duration；click时间<500ms、move<8vp；settle走当前flat/native路径。',
    curve:'原raw move线性、无跟手缓动。',
    interruption:'horizontal方向首次抢占后冻结ownership，反转后的UP若原方向signedDistance<8则回退；verticalPrevious UP仍需24。系统CANCEL仅rollback包含书签预览，不执行新page/bookmark提交。',
    reducedMotion:'减少自动settlement视觉，点击/手势ownership与原数据提交条件不改变。',
    sources:[r('ReaderPageGestureState.ts',55),r('ReaderPageGestureState.ts',182),r('ReaderPageGestureState.ts',225),r('ReaderPageGestureState.ts',271),r('LocalReadingExperience.ets',12169)],
  },
  {
    id:'reading.page.flat',label:'平面滑动、覆盖翻页与回退',origin:'当前主线 ReaderPageTurnStage + ReaderPageSettlementTimeline',
    trigger:'paged slide/cover已准备好相邻页，manual/auto/tts共用requestReaderPageTurn门禁。',
    properties:'驻留两个稳定物理slot，当前/相邻角色切换不卸载目标surface。slide两页X平移；cover遮盖层投射contact阴影radius16/offsetX6。rollback目标offset0；合格ordinary展示先行、persistPresentedProgress异步确认；业务目标/非ordinary仍等durable交接。',
    duration:'distance<.01则0；rapid backlog cue30ms；否则T=clamp80..320(distance/max(max(1,W)×2.5,directionalSpeed)×1000)，directionalSpeed仅朝目标的velocity。',
    curve:'position=from+(target-from)×[1-(1-t)³]，单调ease-out，native postFrameCallback逐帧采样。',
    interruption:'regrab以当前已发布offset重新定触点，旧timeline identity/generation失效；CANCEL/提交失败回原页，未知持久化不能重复写。presentation barrier仍独立；ordinary展示不等CAS receipt，非ordinary才等真实持久化结果，目标slot ready后才释放旧surface。',
    reducedMotion:'无动画选择/减少motion时走现有直接呈现终态路径；仍等同提交与presentation barrier。',
    sources:[r('ReaderPageSettlementTimeline.ts',8),r('ReaderPageTurnStage.ets',34),r('ReaderPageTurnStage.ets',96),r('LocalReadingExperience.ets',12588),r('LocalReadingExperience.ets',12672),r('LocalReadingExperience.ets',13083)],
  },
  {
    id:'reading.page.simulation',label:'原生仿真翻页',origin:'当前主线native C++ bookturn，不是网页CSS动画',
    trigger:'仿真能力可用且paged simulation；gesture mailbox / programmatic profile manual、rapid、automatic。',
    properties:'VSync读取最新pointer，把edge直接映射originEdge+displacement并clamp0..W；无edge追赶delay/EMA。tau next起0终1、previous起1终0；commit/rollback按目标tau；theta同release周期归零。',
    duration:'gesture settlement0（remaining<=1e-5）或clamp80..320ms(remaining/max(2.5,towardTargetPagesPerSecond))；programmatic manual320ms、rapid30ms、automatic500ms。',
    curve:'gesture settle tau线性；programmatic manual/rapid ease-out1-(1-t)³，automatic smoothstep t²(3-2t)；theta=theta0×(1-smoothstep)。',
    interruption:'regrab从已呈现native pose取得新generation；一帧最新输入不排旧sample队列。目标slot/texture/ArkUI内容ready分别核对，终帧保留直到接管完成；失败沿现有2Dfallback/回退。',
    reducedMotion:'主owner决定不使用自动仿真时呈现无动画终态；移植必须保留位置/presentation门禁，不把“支持仿真”静态当已可用。',
    sources:[n('bookturn_motion.h',15),n('bookturn_motion.cpp',27),n('bookturn_motion.cpp',88),n('bookturn_motion.cpp',119),r('LocalReadingExperience.ets',12433),r('LocalReadingExperience.ets',12719)],
  },
  {
    id:'reading.autopage.clock',label:'自动翻页倒计时与暂停',origin:'当前主线 ReaderAutoPageCoordinator，业务计时，不是独立页面动画',
    trigger:'配置2–20秒interval、0–180分/0–59秒session timer，开始先stop TTS barrier，真实admitStart后开启。',
    properties:'pageDeadline=now+remaining×1000；每次schedule delay=max(1,min(1000,deadline-now))；remaining=ceil((deadline-now)/1000)。due只提交一个turn；awaitingPageCommit时不排重复page timer。',
    duration:'默认8秒/page，默认会话15:00；用户配置取真实值，不统一写“6秒/关闭”。native automatic仿真500ms独立于倒计时。',
    curve:'倒计时离散秒，无动画easing；高亮/翻页使用原正文与页面stage。',
    interruption:'pause捕获页与会话remaining，清两个timer；resume新deadline不消耗paused时间。stop/dispose/session变化提升generation并取消pendingStart/turn；EOF停止。调整speed running且无pending commit时重置下一页deadline。',
    reducedMotion:'不减少业务倒计时；仅呈现路径使用减少动画，TTS停止门禁不省略。',
    sources:[r('ReaderAutoPageFullState.ts',24),r('ReaderAutoPageCoordinator.ts',50),r('ReaderAutoPageCoordinator.ts',77),r('ReaderAutoPageCoordinator.ts',136),r('LocalReadingExperience.ets',8249)],
  },
  {
    id:'reading.tts.waveform',label:'朗读装饰波形',origin:'当前主线 ReaderTtsWaveformModel；非真实音量采样',
    trigger:'实际TTS playing改变，waveform可见且active非frozen时订阅一个shared native-frame clock。',
    properties:'24条2.5宽/radius2，base heights [7,13,9,18,12,22,15,10,20,14,8,17,11,21,13,9,16,12,19,10,14,8,15,11]；idle高4，color idle42%alpha→TEAL，Row26高。',
    duration:'高度transition300ms、颜色350ms；每bar delay=index×30ms，往返cycle650+(index%5)×110ms。',
    curve:'高度/颜色cubic(.25,.1,.25,1)；cycle cubic(.42,0,.58,1)，scale=.4+.75easeInOut(alternate)，active opacity=.75+(index%3)×.12。',
    interruption:'setPlaying先采样当前published姿态再转目标；不可见/冻结/生命周期取消订阅，不停止真实音频。旧frameGeneration无效；Quick/Full同clock，source launch冻结快照不新起周期。',
    reducedMotion:'高度/颜色立即到target，scale=1且不schedule循环；声音业务继续。',
    sources:[r('ReaderTtsWaveformModel.ts',2),r('ReaderTtsWaveformModel.ts',28),r('ReaderTtsWaveform.ets',8),r('ReaderTtsWaveform.ets',45),r('ReaderTtsWaveform.ets',77)],
  },
  {
    id:'reading.session.launch',label:'朗读与自动翻页收进沉浸胶囊',origin:'当前主线 ReaderSessionLaunchController 的presentation＋独立业务ACK',
    trigger:'真实Quick/Full TTS或AutoPage播放source已测量且身份有效后开始；目标是原阅读页底部session capsule。',
    properties:'同一source组合沿flight收为24圆点后扩为TTS94/auto96胶囊（localized width可更大）；source clips随flight释放，content scale Quick .084 /Full auto .076 /Full TTS .077，sharp/blur/source→canonical交接；无“已启动成功”页。',
    duration:'design timeline3500ms乘当前timeScale .5→1750ms实际；control release350ms、source release700ms、settled1150ms、finished1750ms。flight design200..1400，dotHold1400..1700，expand1700..2300。',
    curve:'flight cubic(.4,0,.2,1)，expand(.2,0,0,1)，easeIn(.42,0,1,1)、easeOut(0,0,.58,1)、easeInOut(.42,0,.58,1)；各track经同一elapsed采样，无独立隐式clock。',
    interruption:'preparing时按pause只更新desiredPlaying，ACK不伪造paused；failure/stopBarrierFailure/openControl/sourceChanged冻结现pose等待控制owner ready后handoff，stop走exitPending，其它lifecycle释放。late snapshot/ACK由generation+book/content/source身份拒绝。',
    reducedMotion:'sample直接design3500终态，取消正在重放；取消该设置不重播已经观察到的launch。数据/音频真实ACK仍必要。',
    sources:[r('ReaderSessionLaunchPresentation.ts',6),r('ReaderSessionLaunchPresentation.ts',200),r('ReaderSessionLaunchController.ts',6),r('ReaderSessionLaunchController.ts',104),r('ReaderSessionLaunchController.ts',130),r('ReaderSessionLaunchController.ts',159),r('ReaderSessionLaunchCurves.ets',6),r('LocalReadingExperience.ets',9650)],
  },
  {
    id:'reading.tts.lifecycle',label:'朗读准备、试听与回调中断',origin:'当前主线TTS coordinator/配置overlay；业务状态反馈',
    trigger:'播放/暂停/恢复/下一句/上一句/seek、语速/音色/引擎改变、试听、音频中断或错误。',
    properties:'播放与定位都携sessionGeneration/utteranceGeneration/requestId/contentVersion；playing仅真实onStart，音色配置选择/试听分别busy与previewId；等待/失败留原卡或选择layer。',
    duration:'Host speak接受→onStart watchdog默认15000ms；语音播放时长由真实内容/引擎/rate决定；配置onChoose/onPut/onPreview无固定UI动画时长。',
    curve:'状态文本/disabled更新无源码专属transition；系统音频回调与LoadingProgress不可套推测curve。',
    interruption:'stop提升session与utterance generation，取消timer/request；pause/seek提升utterance或position generation，旧complete不能推进新位置；配置close/选择/CANCEL停止试听，错误保持原draft。',
    reducedMotion:'不缩短speak/watchdog/试听业务；只waveform和capsule动画减弱。',
    sources:[r('ReaderTtsSessionCoordinator.ts',24),r('ReaderTtsSessionCoordinator.ts',1142),r('ReaderTtsState.ts',235),r('ReaderTtsConfigOverlay.ets',247),r('ReaderTtsConfigOverlay.ets',260)],
  },
  {
    id:'reading.load.rollback',label:'章节加载、换源与失败回退',origin:'当前主线 owner 事务与原位UI，不新增过程页',
    trigger:'章节/书签/搜索目标、同章refresh、换源、首次正文加载与准备相邻页。',
    properties:'loading只原source-window或existing body/row的反馈；开始不修改可见原页/旧scalar，业务目标提交后才换内容/关窗；coldFirstPaint及合格ordinary先publish后异步persist，late回执不重放/回退；图像无像素仍保留fragment几何。',
    duration:'网络/Core/测量没有固定成功耗时；页面settlement watchdog2000ms、相邻准备重试base250ms按2^count增长封顶2000ms，仅内部时限，不是“等2秒”页面。',
    curve:'原生LoadingProgress旋转由系统决定，源码没有固定curve/周期；业务完成/失败原位更新。',
    interruption:'source/content/book/lifecycle/selection token拒旧回调；transaction pending rollback禁close。失败重试携原ticket，未知写入先回读核对；显式cancel不得丢原页/书签/记录。',
    reducedMotion:'加载与事务durable保护不缩短，系统反馈语义保持。',
    sources:[r('LocalReadingExperience.ets',903),r('LocalReadingExperience.ets',11635),r('LocalReadingExperience.ets',11250),r('ReadingSurface.ets',405),s('SourceSwitchWindow.ets',481),i(5480)],
  },
  {
    id:'reading.brightness.pointer',label:'亮度跟手与写入取消',origin:'当前主线 PanGesture + window-wide brightness writer；非额外动画',
    trigger:'Quick38×190亮度轨道单指pan或tap；轨道104高，交互24宽，百分比1–100/step0.1。Full opacity0禁用整棵亮度子树。',
    properties:'preview=round0.1(clamp1..100(startPercent-offsetY/104×99))；tapPercent=1+(1-clamp0..104(localY)/104)×99。每个changed MOVE直接emit，不UP延迟节流；window值使用已复用AOSP HLG映射，非设备nits标定。',
    duration:'跟手无固定动画时长。native lookup/write/ACK实际时长不定，writer合并未发样本且保留已发写入。',
    curve:'手指坐标线性；UI percent到normalized window brightness使用 ReaderBrightnessCurve 现有HLG曲线，没有视觉easing。',
    interruption:'CANCEL只撤未发pointer samples，等待已发native写入settle，保持current preview直到最终ACK；新drag/自动按钮/read generation使旧UI ACK失效。退出释放owner，生命周期恢复由shared writer负责。',
    reducedMotion:'不改变亮度真实写入或取消条件；仅Full形态沿控制层减少动画策略。',
    sources:[r('ReaderControlPanel.ets',1873),r('ReaderControlPanel.ets',1901),r('ReaderControlPanel.ets',1917),r('ReaderBrightnessCurve.ts',28),r('LocalReadingExperience.ets',10661),{path:'entry/src/main/ets/app/ReaderBrightnessWriter.ts',line:72}],
  },
  {
    id:'reading.timer.neighbour',label:'定时输入邻值点击',origin:'当前主线 ReaderControlTimerWheel；没有滚动动画实现',
    trigger:'自动翻页Full定时字段，点击可用上/下邻值；中心当前值不可点。TimerWheel采用固定identity delta=-1/0/+1。',
    properties:'AutoPage三行各34高，selected17/800，邻11/600及opacity0.56；unit8高/8fp，列space4。valid bounds分钟0–180/秒0–59；下邻超过max或上邻低于min显示空白且禁用。',
    duration:'无PanGesture、惯性、吸附或固定transition duration；onStep立即由原owner更新value。',
    curve:'无专属curve。移植若要求原样，不得增加手势滚轮并称已实现行为。',
    interruption:'interactionEnabled=false或非stopped不接受step；raw CANCEL没有滚轮提交。新value直接投影，无未完成滚动任务。',
    reducedMotion:'无自动动画需缩短；原步进与bounds保留。',
    sources:[r('ReaderControlTimerWheel.ets',17),r('ReaderControlTimerWheel.ets',24),r('ReaderControlTimerWheel.ets',34),r('ReaderControlAutoPageContent.ets',430),r('ReaderAutoPageCoordinator.ts',98)],
  },
  {
    id:'reading.page.continuous',label:'连续阅读滚动与边界章节',origin:'当前主线 native List + ReaderContinuousReadingStage',
    trigger:'continuous正文垂直滚动；tap侧区/自动翻页/音量键调用scrollPage，中心tap打开controls；边界drag选择相邻章。',
    properties:'List隐藏scrollbar、EdgeEffect.Spring、cachedCount6、maintainVisibleContentPosition(true)。Down获取单pointer并取消初始定位；absX或absY>12vp标manual，up stationary且time<500ms才允许TapGesture。',
    duration:'scrollPage({animation:!reduceMotion})及EdgeEffect.Spring使用系统实现；源码未指定固定时长/弹簧参数，不能套分页80–320ms。',
    curve:'原生List默认曲线/惯性/弹簧系数未在源码定义；阅读owner仅负责选章与锚点提交。',
    interruption:'系统CANCEL清stationary/touch且不提交章切换。仅up、|deltaY|>12并且>absX在真实start/end触发boundary；programmaticScrollPending隔离系统scroll stop，old mountIdentity不能报告新内容。',
    reducedMotion:'程序scrollPage animation=false；不跳过测量、可见scalar或durable progress提交，native边界手势仍按原规则。',
    sources:[r('ReaderContinuousReadingStage.ets',46),r('ReaderContinuousReadingStage.ets',294),r('ReaderContinuousReadingStage.ets',353),r('ReaderContinuousReadingStage.ets',391),r('ReaderContinuousReadingStage.ets',694),r('LocalReadingExperience.ets',13179)],
  },
  {
    id:'reading.session.exit',label:'胶囊退出与控制owner交接',origin:'当前主线 LocalReadingExperience.animateTo 与 MotionSpec token',
    trigger:'stop、失败、openControl或sourceChanged后的原session launch终止；handoffPending须先确认原控制source已presented。',
    properties:'sessionLaunchStageOpacity→0；stop footer offset→0、exitProgress→1、footerOpacity→1。正常结束release，冻结handoff保留同source module/Scroll并用opening220ms恢复后再淡出proxy。',
    duration:'reader.session.capsule.exit token200ms（调用fallback也是200）；control owner恢复用open220ms，不是新的Quick→Full过渡。',
    curve:'调用Curve.EaseOut，由平台animateTo采样；源码此处没有额外自定义bezier。',
    interruption:'exitGeneration与launchGeneration双检查onFinish，旧结束回调不能释放新session；source ready后才confirmHandoffReady。finish释放controller并复位chrome owner。',
    reducedMotion:'直接finish，取消proxy与footer动画；真实TTS stop ACK/owner交接仍必需。',
    sources:[c('MotionSpec.ets',133),r('LocalReadingExperience.ets',9637),r('LocalReadingExperience.ets',9650),r('LocalReadingExperience.ets',9670),r('LocalReadingExperience.ets',9682)],
  },
  {
    id:'reading.modal.system',label:'系统确认与失败对话框',origin:'HarmonyOS showAlertDialog / bindPopup / bindContentCover',
    trigger:'清除离线、退出保存失败、刷新/跳转失败、原生更多popup或在线TTS manager。小说更多稿件已按用户要求改用漫画sheet，见reader-more规格。',
    properties:'语义和自定义manager/popup几何由对应specification约束；小说更多稿件共用漫画sheet壳，原生仍bindPopup。AlertDialog chrome及系统transition由HarmonyOS负责，源码没有同一通用“结果反馈页”。',
    duration:'源码未给系统AlertDialog/popup/ContentCover固定动画duration；移植适配应按目标系统原生控件复核，不能填200ms假装已实现值。',
    curve:'系统内部默认curve未证实；源码不显式指定。',
    interruption:'清除autoCancel无写；退出cancel=继续阅读；manager busy禁止dismiss；刷新retry需owner ticket current，菜单选择先close再callback。',
    reducedMotion:'目标系统控件响应系统减少动态效果；现源码业务回调/confirm guard不因此省略。',
    sources:[i(4126),r('LocalReadingExperience.ets',6239),r('LocalReadingExperience.ets',11250),r('ReaderTtsConfigOverlay.ets',78),r('ReaderControlPanel.ets',1539)],
  },
];

// Additional source-derived state parameters for the completed existing modules.
specifications['reader-appearance'].layout.push('ReaderSelectPanel appearanceLibrary：menu104宽/H=25×max(1,n)+8，padding3/r9/border1；行25/paddingX9、font11/13、check11×9。锚点right=layout.x+sectionW−12，top=layout.y+localY+5.5−nativeScrollOffset，localY缩进38/简繁80；below=top+35，放不下改top−5−H，X=right−104/Y均clampviewport。');
specifications['reader-appearance'].behavior.push('onCommit立即提交不可变choice+selectionId，收起完成只卸载；外部关闭不选，Scroll在临时层锁住，返回保留原Full形态。');
specifications['reader-appearance'].sources.push(c('ReaderSelectPanel.ets',150),c('ReaderSelectPanel.ets',263),c('ReaderSelectAppearanceStyle.ts',7));
specifications['reader-directory'].layout.push('小说Quick/Full共用ReaderControlDirectoryContent；Core group/target/disabled控制动作。漫画采用自己的宿主，chapterStartBookmarkCreationEnabled=false，无小说书签tab。书签标题同box含position/time/pending，摘录带1vp色条，Full74/Quick54；undefined投影只loading20spinner+10fp“书签载入中…”，未准入不冒充空。');
specifications['reader-directory'].sources.push(r('ReaderBookmarkRow.ets',42),r('ReaderBookmarkLoadingState.ets',15),r('ReaderDirectoryNavigationList.ets',671));

motionSpec.push({id:'reading.appearance.select',label:'外观临时选项展开／收起',origin:'ReaderSelectPanel + 共享 MotionSpec 当前源码',trigger:'Full缩进／简繁触发；选择、outside关闭或Back关闭。',properties:'同一panel expandedHeight由OPTION_H36收起值到appearanceLibrary fullH=25n+8，chevronAngle0到−180；选项层固定锚点、不新增主路由。',duration:'expand160ms／collapse120ms；业务onCommit立即执行，finish只卸载。',curve:'expand cubic-bezier(.16,1,.3,1)，collapse cubic-bezier(.5,0,1,1)。',interruption:'selectionId改变使generation失效并重置closeInFlight；收起capture当前value/options防止业务回读换字；重复选择/关闭被closeInFlight阻挡，旧finish不卸载新层。',reducedMotion:'直接取展开／收起高度与chevron终态，仍即时commit并按当前identity卸载。',sources:[c('ReaderSelectPanel.ets',242),c('ReaderSelectPanel.ets',263),c('ReaderSelectPanel.ets',276),c('MotionSpec.ets',154),c('MotionSpec.ets',157)]});


// Source drift absorbed at current HEAD: 9b70ff4e219f522efa36f994b12944d61fe93436.
const mangaSource=line=>({path:'entry/src/main/ets/features/manga/MangaReadingSurface.ets',line});
const mangaLayout=[
  '漫画与文本按ReaderShell.contentKind分开挂载。竖向连续/横向分页、图片适配及页锚点由MangaReadingSurface/controller持有；小说朗读/替换/仿真设置不成为漫画控制入口。',
  'persistentDirectory条件：有限W/H且W>=600，deviceIsTablet或W>=900或H>=600；左列W<=700取168，否则258。Phone横屏保留图片canvas，仅使用右侧panel；图片stage始终按剩余width布局。',
  'Top floating chrome：left/right16，top=interactiveSafeTop+10，height52/r18/border1；左右88，back44/换源44，中心title17SerifBold/sub11。Bottom最大560，左右16，bottom=interactiveSafeBottom+12，padding13/14/11，progress48、nav55，三个图标22/标签11。',
  'Phone panel最大snap：目录.78H、mode/settings.67H、more/downloads.5H；max(260,round(H*snap))只是上限，内容不强制填空。grabber30高/42×5；title18/26 static900，close36×36 top24/right12；surface顶角22，scrim #57000000。',
  'wide panel贴右满高、无灰scrim；W<=700取min(320,.85W)，否则clamp(.45W,240,persistent?340:320)。header66/15static600/24line，close34，bottom22；目录wide没有phone搜索工具。',
];
specifications.reader.layout.push(...mangaLayout,
  '漫画图片列表根据真实row.width/height与fileUri作ImageFit.Fill；缺像素时LoadingProgress24或一个primary错误/重试。稿件原创scene只提供正向像素，不证明Core、传输、解码或真机验收。',
  '漫画话末/书末均在原正文底部浮层：完成icon24、type11/19、title23SerifBold、提示13、下一话/返回目录44高；底留48，仍保留右下页码。');
specifications.reader.sources.push({path:'entry/src/main/ets/features/shell/ReaderShell.ets',line:167},mangaSource(1353),mangaSource(1418),mangaSource(1806));
specifications['reader-controls'].layout.push(...mangaLayout);
specifications['reader-controls'].sources.push(mangaSource(1483),mangaSource(1524));
specifications.directory.layout.push(
  '当前BookDirectoryPage.contentKind=manga才进入漫画独立目录：floating/centered PageBackBar在safeTop+8，contentFrame中心max720/左右20；工具卡top=safeTop+66、height126/r14、bookTitle18/24+条目卷组11/16、搜索话/卷toolbar、定位当前24。',
  '漫画目录list top=safeTop+200，bottom=safeBottom+72；target自然高至少58、group至少48（fallback group44），真实Core树承载卷组/target/disabled/descendantCount；current标签正在读，无章节首书签图标。Footer48/r14/border1，左右contentFrame/bottom=max(12,safeBottom)+12，chapter位置与pageOrdinal/total分开显示。',
  '漫画目录下载入口是已有ReaderMangaDownloadPopup：anchor44/icon20，BottomLeft、无箭头，宽min(240,availableWidth)、maxH340、padding8；Core下载动作投影/读取中/错误复用MangaDownloadOperationsPanel，不造另一确认页面。',
  '小说standardPage的目录toolbar内可出现ReaderDirectoryRecoverySurface：书签/离线两有限恢复族，复用ReaderRecoveryNotice+ReaderRecoveryAction；带presentationId/generation核对，offlineBlocked时禁行下载。');
specifications.directory.sources.push(b('BookDirectoryPage.ets',123),b('BookDirectoryPage.ets',229),b('BookDirectoryPage.ets',416),r('ReaderDirectoryRecoverySurface.ets',53));
specifications['reader-directory'].layout.push(
  '漫画：phone章节sheet的搜索框44高/icon17、marginBottom17，定位/排序38高/top6/bottom29，列表H=min(330,max(0,panelContentH-228))；wide右面板没有phone工具，列表填满剩余空间。漫画无书签tab、无小说Quick/Full连续morph。既有manga-full样本指宽屏宿主展示，不是phone造出的Full控制页。',
  '漫画常驻catalog：顶部80，书名18/26（W<=700取16），章节目录10/17；目标行48高，group44且非首group间隔12，默认level>1 left28（narrow20），current static550/12（narrow11）与正在读9（narrow8）。普通sheet target phone58/wide50，group48/13static600，折叠箭头16/180ms ease。',
  '漫画empty fallback可出现“打开完整目录”，只在admittedEntries为空且query为空；Index.openReaderControlDirectory还要求活跃阅读会话/detailToc非空/route=reading。该条件路由ReaderFullDirectory（generic FullDirectoryPanel），不是直接把漫画sheet变成小说Full模块。');
specifications['reader-directory'].sources.push(mangaSource(1642),mangaSource(1651),mangaSource(1678),{path:'entry/src/main/ets/features/manga/MangaReadingDirectoryFallback.ets',line:265},r('ReaderDirectoryNavigationList.ets',576),i(4642));
for(const id of ['manga-mode','manga-settings','manga-more','manga-downloads'])specifications[id]={layout:[...mangaLayout],typography:['正文UI使用实际静态ReaderMangaSans550/600/900与NotoSansSCUIRegular；字体按当前打包资源映射。'],behavior:[],adaptation:[...adaptation],sources:[]};
specifications['manga-mode'].layout.push('阅读模式两槽43高/r12/gap8，图18，选中green/白字；图片适配三行46高，原标签跟随书源/适合屏幕/完整图片，选中check18。');
specifications['manga-mode'].behavior.push('direction仅vertical/horizontal；fit source/width/contain在同owner更新并保留可见锚点，真实资源重新布局完成后保存，不转小说模块。');
specifications['manga-mode'].sources.push(mangaSource(1718));
specifications['manga-settings'].layout.push('阅读底色暖纸/深墨43高；亮度20–100/step1/24高，页码toggle38×23/46row；恢复默认36高。');
specifications['manga-settings'].behavior.push('初始fit source、direction vertical、background跟原偏好（夜间默认ink）、brightness由系统读取（样例50）。恢复默认实际为vertical+width+页码true+brightness78，不重置background。');
specifications['manga-settings'].sources.push(mangaSource(1762),mangaSource(1330));
specifications['manga-more'].layout.push('操作按钮48高/r14：更换书源、重新打开本话/本卷、漫画详情、按下载能力显示下载本话/全部/管理、加入/移出书架。');
specifications['manga-more'].behavior.push('打开详情/刷新/下载/书架操作串行closePanel；opened且!offline才允许重新打开，online接口不可用不伪造成功。');
specifications['manga-more'].sources.push(mangaSource(1792));
specifications['manga-downloads'].layout.push('MangaDownloadOperationsPanel只有Core投影提供的48高操作按钮/gap8；loading/error在同sheet或catalog popup。章节/书籍范围不混，pause与resume互斥。');
specifications['manga-downloads'].behavior.push('MangaDownloadActionsGateway.actions投影：未完成可下载，queued/inProgress可暂停，paused可继续；有效任务可取消，retained可解除保留/删除下载，本话retained且非active/paused可更新，本书可清普通阅读缓存。原owner提交并回读，网页不改本机队列/缓存。');
specifications['manga-downloads'].sources.push({path:'entry/src/main/ets/features/manga/MangaDownloadOperationsPanel.ets',line:17},{path:'entry/src/main/ets/features/manga/MangaDownloadActionsGateway.ts',line:107},mangaSource(1270));
specifications['source-switch'].behavior.push('当前漫画另沿MangaSourceSwitchGateway准备目标：无法匹配已读章时显示已有BookDirectoryPage漫画目录选择目标章（current=-1/page=-1、无下载/书签）；prepareSelected忙时Back仍取消并回原source candidates，commitStarted才禁Back。选择核对原位置和presentation generation，内部首图核验与原子进度CAS完成后采用target，不存在用户可见验证或提交已确认页。');
specifications['source-switch'].sources.push(i(5182),i(5239),i(1561));

specifications['source-switch'].layout.push('漫画目标章节选择复用BookDirectoryPage.mangaPage完整目录；未开始页脚为“尚未开始阅读”/“—”、定位当前禁用，无本书/本话下载；准备和原子提交沿同一目录，源码没有新过程标题或结果页。');

specifications['reader-directory'].layout.push('guarded ReaderFullDirectory独立渲染：topbar phone左右14/16（wide28/30）、top=max(18,safeTop)、54高；panel top=topbarTop+70、phone364/左右12居中，wide720/left>=27/right13，H=min(736/852,H-top-max20safeBottom)，header30/静态抓手42×4（不是小说控制grabber），body含章节/书签tabs、search工具、40行与48当前章footer。顶部离线菜单142×85、两项42高。漫画chapterStartBookmarkCreationEnabled=false，已有bookmark仍可读/删。');
specifications['reader-directory'].sources.push(r('ReaderFullDirectory.ets',163),r('ReaderFullDirectory.ets',339),r('ReaderFullDirectory.ets',413),r('FullDirectoryPanel.ets',271),{path:'entry/src/main/ets/features/shell/ReaderShell.ets',line:282});
specifications['reader-replace'].behavior.push('writeUncertain不锁形态：Quick完整管理只检查quickInput&&!mutationPending，Full完成/抓手归控制owner；quick-write-uncertain与write-uncertain保留同未知状态，预览与写入仍禁用，纯列表读取不能冒充写入确认。');

specifications['reader-appearance'].typography.push('当前字体预览system=HarmonyOS Sans（平台字体，网页使用浏览器可用family/fallback）；sans映射实际ReaderNotoSansSCUIRegular，其他槽映射打包字体。native未ready时也回HarmonyOS Sans/opacity.65；字体ready后按实际slot显示。');
specifications['reader-appearance'].sources.push(r('ReaderControlAppearanceContent.ets',552),r('ReaderAppearanceRenderStyle.ts',44));
specifications.directory.behavior.push('新Core回执恢复在原standardPage tools区消费ReaderRecoveryNotice/ReaderRecoveryAction；bookmark部分确认、unknown、offline unknown、旧全局clear互斥和canContinueOriginal分别按原receipt/generation保护。unknown清理令chapterDownloadEnabled=false；纯列表读取不构成写入确认。');
specifications.directory.sources.push(r('ReadingDirectoryRecovery.ts',23),c('ReaderRecoveryNotice.ets',14),c('ReaderRecoveryAction.ets',17));

specifications.reader.layout.push('漫画图片等待保留真实测量槽/24LoadingProgress；一个primary failed slot只显示MangaUserError文案与原重试，相邻failed slot为Blank。recovering/内容替换恢复/login需要通过controlsPresentedForWindow保留顶部/底部chrome，44高确认位置/新版首图/登录动作仍在原阅读视口，opened=false底部页位置为“—”且seek/previous/next禁用；无新恢复页面。');
specifications.reader.sources.push(mangaSource(948),mangaSource(1426),mangaSource(1506),{path:'entry/src/main/ets/features/manga/MangaUserError.ts',line:10});
