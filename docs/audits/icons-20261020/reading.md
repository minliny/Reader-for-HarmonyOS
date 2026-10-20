# 阅读、漫画、换源与导航壳图标审计

2026-10-20。范围：`features/reading/**`、`features/manga/**`、`features/shell/**`、`features/source/SourceSwitch*`；引用的公共图标载体、颜色登记及 SVG 也沿实际调用核对。只读生产源码，唯一新增文件为本分册；没有运行门禁、编译、构建、安装或设备操作。

结论：本范围有 **2 项可以由源码确认的具体问题、5 项主题/表达/保留范围风险**。这些不等于所有旧图标都应换色或换尺寸。当前入口、独立目录、阅读快捷/完整控制和漫画面板分别审阅；旧模块及仅验证页面引用单列。

## 判定依据与边界

- 用户此次要求覆盖所有交互图标和显示图标。图形、颜色、背景、尺寸、线宽、状态、主题、点击语义及展开方向都纳入，不能只检索 `Image` 后认为图标已统一。
- `docs/message-ui/approved-scope-20261019.json` 规定：无法确定总量的等待使用鸿蒙原生 `LoadingProgress`；书签内容加载32、文字动作加载18；书签手势保持同纸色、书签图标与方向箭头；失效漫画图保持透明、轻边界、单元格居中32图标。该文件同时保留未单独纳入的播放器、正常控件、换源候选及其他结构。不能把本次审计自动变为全量重画授权。
- `docs/ui-design/app-baseline/CLASSIFICATION.md:10–25` 区分真实观察、已确认方向与未确认绘制；旧 HTML、候选资源、旧源码注释不等于最终像素批准。
- `ReaderTokens.ets:8` 明确活动 UI 使用动态 `readerAppColor(role, scheme)`。图标自身是资源烘焙色时，要同时看资源分支和所处表面；资源名相同不保证当前背景正确，资源名不同也不自动构成问题。
- 同功能不同上下文允许有限配方：主导航选中图标在深底上使用 onPrimary；目录行下载状态与工具动作不是同一语义；TTS 保留专属 teal/clay 配方；正文插图、封面、纸纹、朗读高亮 Canvas 不计为界面图标。
- 本分册使用总表的官方 ETS AST 清单 `source-index.json`，再人工沿当前调用与资源核对。扫描本范围243个 ETS/TS文件，直接叶节点147处（143 Image、4 LoadingProgress），直接符号候选5处、绘制候选4处、自定义载体4处、资源引用274处。包含正文图像、历史/未挂载组件及重复 builder 分支，**不可把147称为147个当前可见图标或设备覆盖数**。

## 确定问题

| 编号 | 状态/触发 | 证据 | 判断与影响 |
| --- | --- | --- | --- |
| RD-01 | 夜间应用主题，朗读快捷或完整控制的停止按钮 | [ReaderControlTtsContent.ets:627](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlTtsContent.ets:627) 固定 `reader_tts_make_stop`；[同文件:633](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlTtsContent.ets:633) 停止文字使用 `TOK_TTS_CLAY`；[ReaderThemeRegistry.ts:709](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/common/ReaderThemeRegistry.ts:709) 夜色 `#DC9E53`；[reader_tts_make_stop.svg:1](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/resources/base/media/reader_tts_make_stop.svg:1) 固定 `#A8543A` | **同一个控件内图标与语义文字/底色使用不同主题色源**。没有 night 资源；registry 对该资源仍保留日色，不是动态 tint。日间一致，夜间确定不一致。修复应沿现有 clay 夜色，不新设颜色；尚未修改。 |
| RD-02 | 漫画底栏左右翻页图标按钮 | [MangaReadingSurface.ets:2174](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2174)、[同文件:2190](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2190) 为 `Button('‹')`/`Button('›')`，只有字形，没有明确 `accessibilityText` | **交互语义名称缺失**；辅助功能无法从图标节点得知“上一页/下一页”。小说章切换同类按钮已有明确名称（ReaderControlPanel:1681、1714）。字体字形样式是否保留另列，不以此自动换成 SVG。 |

## 风险、保留差异与未决规则

| 编号 | 证据 | 当前事实 | 分类/处理边界 |
| --- | --- | --- | --- |
| RD-R01 | [LocalReadingExperience.ets:13051](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/LocalReadingExperience.ets:13051)、[同文件:13072](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/LocalReadingExperience.ets:13072)、[ReaderAppearanceRenderStyle.ts:40](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderAppearanceRenderStyle.ts:40) | 纸面书签图标按全局应用 `readerAppScheme` 选日/夜资源，紧邻箭头和提示字却按 `visibleReadingAppearance().activeTheme` 的 chromeMeta 选色；应用主题与阅读纸色可分别存在 | **纸面图标主题来源风险**。应用日间+阅读夜间、反向组合需明确图标按纸面还是应用主题。当前加载页返回图标已用阅读 theme 的 chrome tone，存在可复用的既有判断。不能只凭资源存在称夜间纸面已经验收。 |
| RD-R02 | [SourceSwitchSpinner.ets:103](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/source/SourceSwitchSpinner.ets:103)、[SourceSwitchProgress.ets:50](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/source/SourceSwitchProgress.ets:50)、[SourceSwitchWindow.ets:681](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/source/SourceSwitchWindow.ets:681) | 两处换源等待仍用 Path 圆环 + 自有 animator，不是 `LoadingProgress`；有 foreground/reduceMotion/epoch 处理 | **原生加载方向与历史保留范围的差异**。它是此前换源有限样式保留，不冒称本轮消息迁移新增错误；总规则要求原生等待，但旧 scope 也保留换源结构。需统一这项例外归属后替换，不能声称所有加载已原生化。 |
| RD-R03 | [ReaderDirectoryToolbar.ets:38](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryToolbar.ets:38)、[同文件:43](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryToolbar.ets:43) | 一个工具按钮同时绘制 helper 返回资源和显式分支资源；相同24尺寸重叠，源码解释为设备 Resource 丢图 fallback，并保留第一层供旧 probe | **重复绘制风险**，不是已证明重影。两层都渲染时边缘抗锯齿可能叠加，且存在两个图像 actor；不应为测试保留额外生产绘制。需要选择一个设备可靠的实际分支，不能因此修改图形、颜色或顺便跑全门禁。 |
| RD-R04 | [ReaderControlTtsContent.ets:655](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlTtsContent.ets:655)、[同文件:686](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlTtsContent.ets:686) | 快捷定时展示下拉箭头，但点击 `cycleQuickTimer()` 在预设间循环，没有展开选项；accessibility 名称实际为“切换定时” | **图标暗示与动作不一致的既有保留交互**，不记为已批准新需求失败。需要决定保持循环并换表达，还是改为选择列表；本次不擅自增加流程。完整态配置行真正打开列表，可保留下拉/右向入口语义。 |
| RD-R05 | [MangaReadingSurface.ets:2168](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2168)、[ReaderIconButton.ets:8](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/common/ReaderIconButton.ets:8)、[同文件:28](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/common/ReaderIconButton.ets:28) | 漫画根据独立 backgroundPreference 选择图标与面板表面，公共 ReaderIconButton 的 press recipe 只读全局应用 scheme | **按下反馈主题上下文风险**；实际图标资源分支已按漫画纸色正确选择，但公共反馈没有接收同一 scheme。与 RD-R01 不同：此处是按下表面，不能因此把静态图标也判错。 |

## 按当前组件和状态的清单

下表列实际图标族/状态，末尾叶节点明细补足每个源码落点。`day/night` 表示当前分支存在，不能代替设备像素结论。

| 组件/区域 | 全部图标与状态 | 来源/尺寸/背景 | 接线与判定 |
| --- | --- | --- | --- |
| ReaderControlPanel 顶栏 | 返回、换源、更多；本地书禁用换源 | rc_arrow_left24、rc_switch_horizontal20、rc_dots20；日夜资源；阅读 surface；点击框44×42/62×42/34×42 | 返回退出阅读、换源、打开更多分别连接原动作；本地换源 opacity .4+disabled；正常保留尺寸，不因与漫画22不同判错 |
| ReaderControlPanel 快捷动作 | 搜索、自动翻页、替换 | rc_search/rc_autopage/rc_replace24；day/night；elevated 卡 | 三个语义入口；更多按钮不是下载的替代图标；当前按钮命名完整 |
| ReaderControlPanel 章节/亮度 | 上章/下章、太阳 | rc_chevron_left/right20；rc_sun；day/night；可用 elevated/不可用 disabledBG | 上下章 disabled+.4；亮度太阳为显示辅助；尺寸与工具主入口不同属合理层级 |
| ReaderControlPanel 模块导航 | 目录、朗读、界面、设置，selected/unselected | 24图标/42圆；选中专属nav_active onPrimary + primary底；未选中rc图标+activeSoft | 每个模块有有限选中资源和day/night；selected 不是改filled轮廓；朗读unavailable=.72表达能力状态仍可进模块 |
| ReaderControlPanel 模块标题 | 目录/书签、朗读、界面、设置、自动翻页、搜索、替换 | 标题16，replace几何帧尺寸；day/night | 标题图标是显示；不逐一做按钮。收起为文字动作，未伪造点击图标 |
| ReaderControlDirectoryContent | 目录/书签 tab 的选中与未选中图标 | 15；active primary/soft +下划线；day/night | tab只切当前面板；目录选中用rc_list，未选中用directory，书签实心/空心属于状态表达 |
| ReaderDirectoryToolbar | 搜索、顶部、底部、正序/倒序 | 24/32方框；panelSoft；day/night；见RD-R03双层绘制 | 顺序图标按ascending变化；搜索与列表滚动动作分开；没有所有状态都同方向 |
| ReaderDirectoryNavigationList 文本行 | 分组收起/展开、下载/已下载、书签空/实 | 分组Text `›/⌄`，download/bookmark15/26热区；day/night | 分组方向随expanded，已下载下载入口的check仍连接管理动作；unknown下载无图标而非伪造失败 |
| ReaderDirectoryNavigationList 漫画 | 当前locate角标、分组折叠、下载/完成、非当前右箭头 | grid下载12、named15、折叠16、locate按visual；day/night或显式mangaScheme | 当前locate纯展示None；分组 down 在collapsed旋转−90°变右；搜索强制展开并禁用折叠；下载子热区隔离行选章 |
| ReaderDirectoryChapterRow | 下载/完成、无书签/已有书签 | 15；day/night；随真实entry状态 | 下载与书签有独立动作名称；完成check代表已下载不是正在读；unknown状态不提供虚假动作 |
| ReaderBookmarkRow | legacy图标，当前control motionBody无图标 | legacy书签12；day/night；motion版以文字/摘录线表达 | 不能把legacy图标统计成当前快捷/完整卡片都有图标；行点击跳精确书签锚点 |
| ReaderBookmarkLoadingState | 载入中 | 原生LoadingProgress32，READ_PRIMARY | 命中批准32规则；加载不是可点击图标 |
| ReaderBookmarkEmptyState | 书签空态 | 28空书签资源+ReaderPageState；day/night | 静态显示，返回目录只切tab；不当作下载失败 |
| ReaderChapterLoadingState | 载入中、取消返回 | 原生LoadingProgress32按阅读theme ink；ReaderIconButton20/32，icon按reading chrome tone | active/reduceMotion控制；返回有“取消加载并返回”；使用阅读纸色主题的正向参照 |
| LocalReadingExperience 纸面书签反馈 | 空/实书签、向下/释放阈值后向上 | 资源书签，测量slot；Text↓旋转180；同纸面无额外色块 | direction follows bookmarkPreviewChanged；未到阈值.35，隐藏状态与controls互斥；资源theme来源见RD-R01 |
| ReaderControlAutoPageContent | 返回、双上章/下章、开始/暂停、停止、时钟 | 返回11，双chevron16，play/pause20，stop17；day/night；有限surface配方 | 两个chevron错位5vp组成快进/后退，不是RD-R03同位重复；上/下章缺失及stopped禁用+.4；运行状态切换图标 |
| ReaderControlTtsContent 传输/时钟 | 播放/暂停、停止、前句/后句、耳机、时钟、plus/minus | toggle13→20、前后14→26、stop10、clock13、加减12；Quick→Full几何轴；day/night（stop例外） | shared/full input、serviceBusy、queue与stopping检查；不以busy伪造播放；停止night见RD-01；波形独立显示不当loading |
| ReaderControlTtsContent 引擎/配置 | 系统/在线引擎、selected check、定时down、配置chevron | 引擎20/check16/下拉8×4/配置12；day/night；TTS card | selected check仅选择时opacity1；引擎busy禁用；定时循环箭头见RD-R04；其他配置真正进入列表 |
| ReaderTtsConfigOverlay | 当前选项check | 11×9；day/night；公共选择/管理表面 | 选中状态和保存动作分开，不以check表示已持久化；第三方配置管理沿原有入口 |
| ReaderControlSearchContent | 搜索显示图标、返回 | 搜索16，返回11；day/night；模块表面 | 搜索图标不替代真实搜索按钮；返回只回控制首页；输入清除由公共字段审计 |
| ReaderControlReplaceContent | 返回、导入/导出/预览/管理等菜单图标 | 返回11，操作20；day/night；资源由方法选择 | 同动作busy、生成与真实operation归属保持；开关为ReaderControlSwitchTrack，不是图标误计 |
| ReaderControlAppearanceContent | 选择器箭头、加减（文本符号）、配色/字体预览 | ReaderSelect/ReaderSelectPanel继承公共图标；减加为文字动作；主题swatch非图标 | 无直接Image；主题颜色圆块是内容选择样本，不应统一成强调色；公有选择器细节归公共分册 |
| ReaderControlSettingsContent | 开关轨道；其余文字选项 | ReaderControlSwitchTrack；无直接资源图标 | 不给每个设置选项自增装饰图标；unavailable选项禁用/.55 |
| ReaderSessionCapsule | 耳机、播放/暂停、自动翻页倒计时 | 耳机11/16slot，play/pause8/16circle；day/night；outer44热区 | 子图标无命中，由整体胶囊接收toggle；preparing按desiredPlaying显示意图；倒计时是数字不是旋转loading |
| ReaderFullDirectory + FullDirectoryPanel | 返回、换源、更多；目录/书签tab、搜索/顶/底/排序、下载/完成/书签 | 返回/头部按现有20/24；工具16；标记通过finite helper；day/night | 当前独立完整目录可见；FullDirectoryPanel同时用于验证页，不等于测试专用；下载管理与已下载check共存按语义核对 |
| MangaReadingSurface 纸面/底栏 | 失效图片、原生等待、返回、换源、更多；左右翻页；目录/阅读方式/设置；章末check | 图片失效32，loading32；返回/更多22/44，换源18/44×42，footer22；字形‹›20/28；check24 | 图片失效透明+轻边界，按逻辑图而非tile居中；未增失败计数/逐图重试；翻页缺语义名RD-02；主控theme按backgroundPreference |
| MangaReadingSurface 面板 | close；上一章、完整目录、下一章；竖/横、暖纸/深墨、适配check | close18，工具visual尺寸；choice18，fitcheck18；selected onPrimary +green，unselected muted +soft | choiceIcon四类有selected/normal/night有限资源；折叠箭头不在此错误复用；close对应其真实面板；公共press主题风险RD-R05 |
| MangaReadingSurface 更多菜单 | 换源、刷新、详情、下载本话/整书/管理、入/出书架 | ReaderActionSheetAction传显式资源；下载visual族与书架族混用登记；day/night | disabled刷新/未打开本话条件明确；移出为danger、入架default；实际统一色由公共sheet和资源审计合并，不新造主题 |
| MangaDirectoryEntryRow | 当前locate角标；下载/完成；分组折叠；非当前右箭头 | grid12/named15；locatevisual；fold16，right13；day/night显式scheme | expanded=down/collapsed=right；搜索下强制expanded且禁用折叠；locate为显示无点击；download与阅读热区隔离 |
| MangaReadingDirectoryFallback | 委托ReaderDirectoryList/NavigationSurface的全部目录图标 | 不直接绘制Image | 保留fallback数据准入与相同颜色/方向规则；不能漏掉委托后把本文件记“无图标功能” |
| MangaDownloadOperationsPanel | pause/resume/cancel/update/release/delete/clear/default download；读取状态loading | ReaderActionSheetContent；download_visual族day/night；LoadingProgress32 | scheme可显式覆盖漫画独立纸色；clear/delete danger，release不是danger；loading原生，failure短动作重试 |
| MangaBoundaryTurnFeedback | 向上箭头 | Text↑，MESSAGE_GESTURE_ICON，跟纸/字色，无按钮 | 已批准章末上拉方向正确；armed只改caption，翻章在release，不把↑当可点击按钮 |
| SourceSwitchWindow | close、搜索/发现spinner、重新查找refresh | close按visual/44hit；search同spinner尺寸；refresh按visual；day/night | switching/rollback关闭禁用，查找时按钮变“停止”并不显示refresh；自绘spinner例外RD-R02；cover是内容不计icon |
| SourceSwitchProgress | 切换spinner、可取消时close | spinner有限visual；close44hit；day/night | 无实际cancel能力时不显示close；customspinner见RD-R02 |
| SourceSwitchCompletionOverlay | 无图标 | 纸面wash+文字短提示 | 不为成功回执新增check；wash纸面与toast应用表面区别合理 |
| MainTabBar | 书架、设置；发现/RSS代码保留关闭 | 24图标，Phone/Tablet有限底栏/侧栏；active onPrimary深底；inactive muted | 列表来自productScope；bookshelf专用rail只用于书架当前页，不能把其固定library active资源误判为设置激活错误；RSS/发现不计当前可见入口 |
| ReaderShell/SettingsShell/MainTabShell | 委托阅读/目录/主Tab图标 | 不直接绘制新图标 | 作为入口与可见性宿主核对，不重复当作新的图标配方 |

## 保留组件、历史与非图标图像

- 当前生产构造检索没有发现 `ReaderAutoPagePanel`、`ReaderAutoPageFullPanel`、`ReaderTtsFullPanel`、`ReaderTtsModulePanel`、`ReaderReplaceQuickPanel`、`ReaderQuickSearchPanel`、`ReaderSearchFullPanel`、`ReaderSettingsFullPanel`、`ReaderDirectoryModulePanel`、`ReaderAppearanceModulePanel` 的构造入口。部分仍被 type-only import，不能因此宣称运行。其 Image 落点仍完整列在下方，以便排除未来复活旧色。
- `ReaderAppearanceFullPanel` 由 `ReaderAppearanceMotionStage` 构造、再委托 `ReaderAppearanceSharedActors`；当前生产构造检索未找到该 stage 的入口。它们属于保留链，当前 `ReaderControlPanel` 已使用 `ReaderControlAppearanceContent`。不能把两套尺寸差异自动当作当前页面冲突。
- 旧 `ReaderAutoPagePanel:274` 固定 `reader_auto_stop` 没有night分支，是保留链的夜间风险，不混入当前 RD-01。其余保留链全部资源也纳入附表。
- `ReaderContinuousReadingStage`、`ReadingSurface` 的 `Image(fragment.fileUri/imageSource)`、`MangaReadingSurface` retained/tile Image、SourceSwitch cover均为用户内容；`ReaderPaperBackground` 的纸纹/光照为背景；`ReadingSurface`/`ReaderNativeParagraphView` 的Canvas是文本高亮。均不是应统一色的交互/显示图标。
- `Manga/vendor/pulltorefresh` 当前 ETS 无 Image、LoadingProgress、SymbolGlyph、Canvas 或短Text图形绘制，历史 `reader.patch` 中删除行不当作生产图标。
- `FullDirectoryPanel` 是当前独立完整目录的真实内容，同时被 `ReaderControlMotionVerification` 引用；不能因验证页引用而整块排除。

## 尺寸、线宽与主题整体观察

- 已核对的主outline资源普遍采用48 viewBox、3.5原始stroke（如rc_list、marker_download、marker_check、source refresh）。按24显示时有效约1.75vp，按15显示时约1.09vp；这是不同层级尺寸缩放，不能把原始3.5当成设备3.5vp再判粗。
- 漫画choice来自15 viewBox的填充路径，active/normal/night保留同path、不同语义色；与24工具outline不是同一资源规格。本次未看到必要证据证明必须替换为同一线宽。
- 主导航active图标onPrimary、菜单普通图标ink/primary、下载状态check primary、未选中描述muted、危险操作danger可以共存；**同一视觉组中只有某个普通入口突兀变成另一强调色**才应沿该组修正，不能全局全部刷成green。
- 原生LoadingProgress本范围4个直接落点均32；消息动作18由公共组件分册覆盖。自绘SourceSwitch两处为明确例外；当前没有SymbolGlyph直接绘制。
- 小说纸面书签箭头↓在阈值后旋转为↑；漫画章末是↑；文本目录的›/⌄及漫画目录折叠down/−90°方向正确。字体字形的光学差异保留为既有表现，不伪称资源规范已一致。

## 核对结果边界

已完成：本范围全源码静态清点、实际现用/保留链区别、资源分支、状态与语义接线审阅。尚未完成且未执行：任何新HAP、设备像素、触摸命中、屏幕阅读器朗读、对比度及夜间原生视觉验收。本次为审计，不修改生产，不以清单/AST计数代替验收。


## 附表 A：全部直接绘制与载体落点

以下忠实列出静态节点，含保留组件和已明确排除的内容图像。尺寸来自节点自身 modifier，父命中框与状态规则以上文语义表为准；空白不表示没有尺寸。资源条件式简写成资源名集合，完整表达式保存在 source-index.json。

### MangaBoundaryTurnFeedback.ets

| 源位置/Builder | 类型 | 资源/表达式 | 叶节点参数 |
| --- | --- | --- | --- |
| [MangaBoundaryTurnFeedback.ets:14](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaBoundaryTurnFeedback.ets:14) / build | Text | '↑' | fontSize(MESSAGE_GESTURE_ICON.fontSizeFp); accessibilityLevel('no'); fontColor(this.mutedColor) |

### MangaDirectoryEntryRow.ets

| 源位置/Builder | 类型 | 资源/表达式 | 叶节点参数 |
| --- | --- | --- | --- |
| [MangaDirectoryEntryRow.ets:118](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaDirectoryEntryRow.ets:118) / download | Image | reader_directory_marker_check_theme_night / reader_directory_marker_check / reader_directory_marker_download_theme_night / reader_directory_marker_download | width(grid ? 12 : 15); height(grid ? 12 : 15) |
| [MangaDirectoryEntryRow.ets:165](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaDirectoryEntryRow.ets:165) / numberCell | Image | manga_sheet_locate_theme_night / manga_sheet_locate | width(MANGA_DIRECTORY_VISUAL.gridMarkSize); height(MANGA_DIRECTORY_VISUAL.gridMarkSize); hitTestBehavior(HitTestMode.None); accessibilityLevel('no') |
| [MangaDirectoryEntryRow.ets:182](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaDirectoryEntryRow.ets:182) / branchToggle | Image | manga_sheet_chevron_down_theme_night / manga_sheet_chevron_down | width(16); height(16); rotate({ angle: this.expanded(entry) ? 0 : -90 }) |
| [MangaDirectoryEntryRow.ets:263](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaDirectoryEntryRow.ets:263) / fullWidthEntryBody | Image | manga_sheet_chevron_right_theme_night / manga_sheet_chevron_right | width(13); height(13) |

### MangaDownloadOperationsPanel.ets

| 源位置/Builder | 类型 | 资源/表达式 | 叶节点参数 |
| --- | --- | --- | --- |
| [MangaDownloadOperationsPanel.ets:23](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaDownloadOperationsPanel.ets:23) / build | LoadingProgress |  | width(32); height(32); color(readerAppColor('TOK_GREEN', this.effectiveScheme())) |

### MangaReadingSurface.ets

| 源位置/Builder | 类型 | 资源/表达式 | 叶节点参数 |
| --- | --- | --- | --- |
| [MangaReadingSurface.ets:2037](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2037) / retainedChapterPixels | Image | pixel.uri | width(pixel.width); height(pixel.height) |
| [MangaReadingSurface.ets:2045](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2045) / tileImage | Image | uri | width(this.rowDisplayWidth(row)); height(this.rowDisplayWidth(row) * row.height / row.width) |
| [MangaReadingSurface.ets:2062](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2062) / imageViewport | Image | reader_image_unavailable_theme_night / reader_image_unavailable | width(32); height(32) |
| [MangaReadingSurface.ets:2081](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2081) / imageViewport | LoadingProgress |  | width(32); height(32); color(this.mutedColor()) |
| [MangaReadingSurface.ets:2144](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2144) / topControls | Image | reader_directory_switch_theme_night / reader_directory_switch | width(18); height(18) |
| [MangaReadingSurface.ets:2168](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2168) / iconAction | ReaderIconButton | { icon, specId: 'manga-reader-action', accessibilityLabel: label, onTap: action } |  |
| [MangaReadingSurface.ets:2210](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2210) / footerAction | Image | icon | width(22); height(22) |
| [MangaReadingSurface.ets:2239](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2239) / panelOverlay | Image | manga_sheet_close_theme_night / manga_sheet_close | width(18); height(18) |
| [MangaReadingSurface.ets:2296](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2296) / panelOverlay | Image | manga_sheet_close_theme_night / manga_sheet_close | width(this.panel === 'directory' ? visual.closeIcon : 18); height(this.panel === 'directory' ? visual.closeIcon : 18) |
| [MangaReadingSurface.ets:2390](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2390) / directoryTools | Image | manga_directory_previous_theme_night / manga_directory_previous | width(visual.toolIcon); height(visual.toolIcon) |
| [MangaReadingSurface.ets:2398](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2398) / directoryTools | Image | manga_directory_chevron_right_accent_theme_night / manga_directory_chevron_right_accent | width(visual.toolIcon); height(visual.toolIcon) |
| [MangaReadingSurface.ets:2402](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2402) / directoryTools | Image | manga_directory_chevron_right_accent_theme_night / manga_directory_chevron_right_accent | width(visual.toolIcon); height(visual.toolIcon) |
| [MangaReadingSurface.ets:2641](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2641) / sheetChoice | Image | this.choiceIcon(kind) | width(18); height(18) |
| [MangaReadingSurface.ets:2652](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2652) / fitLine | Image | manga_sheet_check_theme_night / manga_sheet_check | width(18); height(18) |
| [MangaReadingSurface.ets:2764](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2764) / chapterEndContent | Image | reader_directory_marker_check_theme_night / reader_directory_marker_check | width(24); height(24) |

### FullDirectoryPanel.ets

| 源位置/Builder | 类型 | 资源/表达式 | 叶节点参数 |
| --- | --- | --- | --- |
| [FullDirectoryPanel.ets:394](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/FullDirectoryPanel.ets:394) / panelHeader | Image | reader_directory_marker_bookmark_theme_night / reader_directory_marker_bookmark | width(16); height(16) |
| [FullDirectoryPanel.ets:398](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/FullDirectoryPanel.ets:398) / panelHeader | Image | reader_directory_directory_theme_night / reader_directory_directory | width(16); height(16) |
| [FullDirectoryPanel.ets:543](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/FullDirectoryPanel.ets:543) / bookmarkTab | Image | reader_directory_marker_bookmark_active_theme_night / reader_directory_marker_bookmark_active | width(15); height(15) |
| [FullDirectoryPanel.ets:547](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/FullDirectoryPanel.ets:547) / bookmarkTab | Image | reader_directory_marker_bookmark_theme_night / reader_directory_marker_bookmark | width(15); height(15) |
| [FullDirectoryPanel.ets:629](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/FullDirectoryPanel.ets:629) / controlButton | Image | reader_directory_search_theme_night / reader_directory_search | width(16); height(16) |
| [FullDirectoryPanel.ets:631](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/FullDirectoryPanel.ets:631) / controlButton | Image | reader_directory_top_theme_night / reader_directory_top | width(16); height(16) |
| [FullDirectoryPanel.ets:633](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/FullDirectoryPanel.ets:633) / controlButton | Image | reader_directory_bottom_theme_night / reader_directory_bottom | width(16); height(16) |
| [FullDirectoryPanel.ets:636](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/FullDirectoryPanel.ets:636) / controlButton | Image | reader_directory_sort_ascending_theme_night / reader_directory_sort_ascending | width(16); height(16) |
| [FullDirectoryPanel.ets:640](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/FullDirectoryPanel.ets:640) / controlButton | Image | reader_directory_sort_descending_theme_night / reader_directory_sort_descending | width(16); height(16) |
| [FullDirectoryPanel.ets:842](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/FullDirectoryPanel.ets:842) / downloadMarkerHitTarget | Image | $r(`app.media.${this.downloadMarker(entry)}`) | width(15); height(15) |
| [FullDirectoryPanel.ets:857](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/FullDirectoryPanel.ets:857) / bookmarkMarkerHitTarget | Image | $r(`app.media.${this.bookmarkMarker(entry)}`) | width(15); height(15) |

### LocalReadingExperience.ets

| 源位置/Builder | 类型 | 资源/表达式 | 叶节点参数 |
| --- | --- | --- | --- |
| [LocalReadingExperience.ets:13051](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/LocalReadingExperience.ets:13051) / bookmarkCornerFeedback | Image | reader_page_bookmark_filled_theme_night / reader_page_bookmark_filled / reader_directory_marker_bookmark_active_theme_night / reader_directory_marker_bookmark_active | width(this.bookmarkCornerLayout().topAccessoryWidth); height(this.bookmarkCornerLayout().topAccessoryHeight); hitTestBehavior(HitTestMode.None) |
| [LocalReadingExperience.ets:13069](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/LocalReadingExperience.ets:13069) / bookmarkCornerFeedback | Text | '↓' | fontSize(MESSAGE_GESTURE_ICON.fontSizeFp); accessibilityLevel('no'); fontColor(readerThemeDefinition(this.visibleReadingAppearance().activeTheme).chromeMeta); rotate({ angle: this.bookmarkPreviewChanged ? 180 : 0 }) |

### ReaderAppearanceFullPanel.ets

| 源位置/Builder | 类型 | 资源/表达式 | 叶节点参数 |
| --- | --- | --- | --- |
| [ReaderAppearanceFullPanel.ets:346](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderAppearanceFullPanel.ets:346) / header | Image | reader_appearance_header_theme_night / reader_appearance_header | width(20); height(20) |
| [ReaderAppearanceFullPanel.ets:786](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderAppearanceFullPanel.ets:786) / selectField | Image | reader_chevron_down_primary_theme_night / reader_chevron_down_primary | width(8); height(4) |

### ReaderAutoPageFullPanel.ets

| 源位置/Builder | 类型 | 资源/表达式 | 叶节点参数 |
| --- | --- | --- | --- |
| [ReaderAutoPageFullPanel.ets:205](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderAutoPageFullPanel.ets:205) / header | Image | reader_auto_full_header_theme_night / reader_auto_full_header | width(16); height(16) |
| [ReaderAutoPageFullPanel.ets:248](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderAutoPageFullPanel.ets:248) / collapsedBackActor | Image | reader_quick_back_theme_night / reader_quick_back | width(11); height(11) |
| [ReaderAutoPageFullPanel.ets:332](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderAutoPageFullPanel.ets:332) / chapterButton | Image | reader_auto_full_chevron_left_theme_night / reader_auto_full_chevron_left / reader_auto_full_chevron_right_theme_night / reader_auto_full_chevron_right | width(16); height(16) |
| [ReaderAutoPageFullPanel.ets:337](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderAutoPageFullPanel.ets:337) / chapterButton | Image | reader_auto_full_chevron_left_theme_night / reader_auto_full_chevron_left / reader_auto_full_chevron_right_theme_night / reader_auto_full_chevron_right | width(16); height(16) |
| [ReaderAutoPageFullPanel.ets:383](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderAutoPageFullPanel.ets:383) / runningButton | Image | reader_session_pause_theme_night / reader_session_pause / reader_auto_full_play_theme_night / reader_auto_full_play | width(20); height(20) |
| [ReaderAutoPageFullPanel.ets:426](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderAutoPageFullPanel.ets:426) / stopButton | Image | reader_auto_full_stop_theme_night / reader_auto_full_stop | width(17); height(17) |
| [ReaderAutoPageFullPanel.ets:494](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderAutoPageFullPanel.ets:494) / timerSection | Image | reader_auto_full_clock_theme_night / reader_auto_full_clock | width(18); height(18) |

### ReaderAutoPagePanel.ets

| 源位置/Builder | 类型 | 资源/表达式 | 叶节点参数 |
| --- | --- | --- | --- |
| [ReaderAutoPagePanel.ets:114](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderAutoPagePanel.ets:114) / header | Image | reader_quick_back_theme_night / reader_quick_back | width(11); height(11) |
| [ReaderAutoPagePanel.ets:186](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderAutoPagePanel.ets:186) / chapterControl | Image | reader_auto_full_chevron_left_theme_night / reader_auto_full_chevron_left / reader_auto_full_chevron_right_theme_night / reader_auto_full_chevron_right | width(16); height(16) |
| [ReaderAutoPagePanel.ets:191](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderAutoPagePanel.ets:191) / chapterControl | Image | reader_auto_full_chevron_left_theme_night / reader_auto_full_chevron_left / reader_auto_full_chevron_right_theme_night / reader_auto_full_chevron_right | width(16); height(16) |
| [ReaderAutoPagePanel.ets:237](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderAutoPagePanel.ets:237) / runningControl | Image | reader_session_pause_theme_night / reader_session_pause / reader_auto_play_theme_night / reader_auto_play | width(20); height(20) |
| [ReaderAutoPagePanel.ets:274](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderAutoPagePanel.ets:274) / stopControl | Image | reader_auto_stop | width(17); height(17) |

### ReaderBookmarkEmptyState.ets

| 源位置/Builder | 类型 | 资源/表达式 | 叶节点参数 |
| --- | --- | --- | --- |
| [ReaderBookmarkEmptyState.ets:11](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderBookmarkEmptyState.ets:11) / build | Image | reader_directory_marker_bookmark_theme_night / reader_directory_marker_bookmark | width(28); height(28) |

### ReaderBookmarkLoadingState.ets

| 源位置/Builder | 类型 | 资源/表达式 | 叶节点参数 |
| --- | --- | --- | --- |
| [ReaderBookmarkLoadingState.ets:15](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderBookmarkLoadingState.ets:15) / build | LoadingProgress |  | width(32); height(32); color(readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme)) |

### ReaderBookmarkRow.ets

| 源位置/Builder | 类型 | 资源/表达式 | 叶节点参数 |
| --- | --- | --- | --- |
| [ReaderBookmarkRow.ets:85](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderBookmarkRow.ets:85) / legacyBody | Image | reader_directory_marker_bookmark_active_theme_night / reader_directory_marker_bookmark_active | width(12); height(12) |

### ReaderChapterLoadingState.ets

| 源位置/Builder | 类型 | 资源/表达式 | 叶节点参数 |
| --- | --- | --- | --- |
| [ReaderChapterLoadingState.ets:23](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderChapterLoadingState.ets:23) / build | LoadingProgress |  | width(32); height(32); color(readerAppearanceThemeStyle(this.theme).ink); enableLoading(this.active && !this.reduceMotion) |
| [ReaderChapterLoadingState.ets:40](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderChapterLoadingState.ets:40) / build | ReaderIconButton | search_back_theme_night / search_back |  |

### ReaderContinuousReadingStage.ets

| 源位置/Builder | 类型 | 资源/表达式 | 叶节点参数 |
| --- | --- | --- | --- |
| [ReaderContinuousReadingStage.ets:247](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderContinuousReadingStage.ets:247) / build | Image | fragment.fileUri | width(`${fragment.imageWidthBasisPoints / 100}%`); height(fragment.imageHeight) |
| [ReaderContinuousReadingStage.ets:253](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderContinuousReadingStage.ets:253) / build | Image | fragment.imageSource | width(`${fragment.imageWidthBasisPoints / 100}%`); height(fragment.imageHeight) |

### ReaderControlAutoPageContent.ets

| 源位置/Builder | 类型 | 资源/表达式 | 叶节点参数 |
| --- | --- | --- | --- |
| [ReaderControlAutoPageContent.ets:286](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlAutoPageContent.ets:286) / quickBack | Image | reader_quick_back_theme_night / reader_quick_back | width(11); height(11) |
| [ReaderControlAutoPageContent.ets:349](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlAutoPageContent.ets:349) / chapterButton | Image | reader_auto_full_chevron_left_theme_night / reader_auto_full_chevron_left / reader_auto_full_chevron_right_theme_night / reader_auto_full_chevron_right | width(16); height(16) |
| [ReaderControlAutoPageContent.ets:351](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlAutoPageContent.ets:351) / chapterButton | Image | reader_auto_full_chevron_left_theme_night / reader_auto_full_chevron_left / reader_auto_full_chevron_right_theme_night / reader_auto_full_chevron_right | width(16); height(16) |
| [ReaderControlAutoPageContent.ets:373](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlAutoPageContent.ets:373) / runningButton | Image | reader_session_pause_theme_night / reader_session_pause / reader_auto_full_play_theme_night / reader_auto_full_play | width(20); height(20) |
| [ReaderControlAutoPageContent.ets:393](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlAutoPageContent.ets:393) / stopButton | Image | reader_auto_full_stop_theme_night / reader_auto_full_stop | width(17); height(17) |
| [ReaderControlAutoPageContent.ets:457](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlAutoPageContent.ets:457) / timerSection | Image | reader_auto_full_clock_theme_night / reader_auto_full_clock | width(18); height(18) |

### ReaderControlDirectoryContent.ets

| 源位置/Builder | 类型 | 资源/表达式 | 叶节点参数 |
| --- | --- | --- | --- |
| [ReaderControlDirectoryContent.ets:322](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlDirectoryContent.ets:322) / tabButton | Image | rc_list_theme_night / rc_list / reader_directory_directory_theme_night / reader_directory_directory | width(15); height(15) |
| [ReaderControlDirectoryContent.ets:325](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlDirectoryContent.ets:325) / tabButton | Image | reader_directory_marker_bookmark_active_theme_night / reader_directory_marker_bookmark_active / reader_directory_marker_bookmark_theme_night / reader_directory_marker_bookmark | width(15); height(15) |

### ReaderControlPanel.ets

| 源位置/Builder | 类型 | 资源/表达式 | 叶节点参数 |
| --- | --- | --- | --- |
| [ReaderControlPanel.ets:1167](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlPanel.ets:1167) / controlHeader | Image | this.headerIcon() | width(16); height(16); hitTestBehavior(HitTestMode.None) |
| [ReaderControlPanel.ets:1203](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlPanel.ets:1203) / replaceHeader | Image | reader_control_replace_header_theme_night / reader_control_replace_header | width(this.replaceHeaderFrame().icon.width); height(this.replaceHeaderFrame().icon.height); hitTestBehavior(HitTestMode.None) |
| [ReaderControlPanel.ets:1487](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlPanel.ets:1487) / topBar | Image | rc_arrow_left_theme_night / rc_arrow_left | width(24); height(24) |
| [ReaderControlPanel.ets:1523](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlPanel.ets:1523) / topBar | Image | rc_switch_horizontal_theme_night / rc_switch_horizontal | width(20); height(20) |
| [ReaderControlPanel.ets:1551](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlPanel.ets:1551) / topBar | Image | rc_dots_theme_night / rc_dots | width(20); height(20) |
| [ReaderControlPanel.ets:1617](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlPanel.ets:1617) / quickAction | Image | $r(`app.media.${this.quickActionIcon(icon)}`) | width(24); height(24) |
| [ReaderControlPanel.ets:1670](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlPanel.ets:1670) / chapterRow | Image | rc_chevron_left_theme_night / rc_chevron_left | width(20); height(20) |
| [ReaderControlPanel.ets:1703](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlPanel.ets:1703) / chapterRow | Image | rc_chevron_right_theme_night / rc_chevron_right | width(20); height(20) |
| [ReaderControlPanel.ets:1803](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlPanel.ets:1803) / brightnessRail | Image | rc_sun_theme_night / rc_sun | width(READER_CONTROL_BRIGHTNESS_ICON_SIZE); height(READER_CONTROL_BRIGHTNESS_ICON_SIZE) |
| [ReaderControlPanel.ets:1982](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlPanel.ets:1982) / moduleButton | Image | $r(`app.media.${this.moduleIcon(icon, module)}`) | width(24); height(24) |

### ReaderControlReplaceContent.ets

| 源位置/Builder | 类型 | 资源/表达式 | 叶节点参数 |
| --- | --- | --- | --- |
| [ReaderControlReplaceContent.ets:342](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlReplaceContent.ets:342) / quickBack | Image | reader_control_replace_back_theme_night / reader_control_replace_back | width(11); height(11) |
| [ReaderControlReplaceContent.ets:354](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlReplaceContent.ets:354) / toolbarButton | Image | icon | width(20); height(20) |
| [ReaderControlReplaceContent.ets:427](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlReplaceContent.ets:427) / ruleIcon | Image | icon | width(20); height(20) |

### ReaderControlSearchContent.ets

| 源位置/Builder | 类型 | 资源/表达式 | 叶节点参数 |
| --- | --- | --- | --- |
| [ReaderControlSearchContent.ets:406](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlSearchContent.ets:406) / searchAction | Image | reader_directory_search_theme_night / reader_directory_search | width(16); height(16) |
| [ReaderControlSearchContent.ets:421](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlSearchContent.ets:421) / quickBack | Image | reader_quick_back_theme_night / reader_quick_back | width(11); height(11) |

### ReaderControlTtsContent.ets

| 源位置/Builder | 类型 | 资源/表达式 | 叶节点参数 |
| --- | --- | --- | --- |
| [ReaderControlTtsContent.ets:489](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlTtsContent.ets:489) / moduleHeader | Image | reader_tts_clock_theme_night / reader_tts_clock | width(13); height(13) |
| [ReaderControlTtsContent.ets:510](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlTtsContent.ets:510) / quickLabel | Image | reader_tts_headphones_theme_night / reader_tts_headphones / reader_tts_clock_theme_night / reader_tts_clock / reader_tts_rate_theme_night / reader_tts_rate | width(kind === 'playback' ? 18 : 16); height(kind === 'playback' ? 18 : 16) |
| [ReaderControlTtsContent.ets:573](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlTtsContent.ets:573) / playback | Image | reader_tts_header_theme_night / reader_tts_header | width(16); height(16) |
| [ReaderControlTtsContent.ets:625](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlTtsContent.ets:625) / roundControl | Image | reader_tts_make_pause_theme_night / reader_tts_make_pause / reader_tts_make_play_theme_night / reader_tts_make_play / reader_tts_make_stop / reader_tts_make_previous_quick_theme_night / reader_tts_make_previous_quick / reader_tts_make_previous_theme_night / reader_tts_make_previous / reader_tts_make_next_quick_theme_night / reader_tts_make_next_quick / reader_tts_make_next_theme_night / reader_tts_make_next | width(kind === 'toggle' ? 13 + 7 * this.p() : kind === 'stop' ? 10 : 14 + 12 * this.p()); height(kind === 'toggle' ? 13 + 7 * this.p() : kind === 'stop' ? 10 : 14 + 12 * this.p()) |
| [ReaderControlTtsContent.ets:686](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlTtsContent.ets:686) / timer | Image | reader_chevron_down_theme_night / reader_chevron_down | width(8); height(4) |
| [ReaderControlTtsContent.ets:755](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlTtsContent.ets:755) / timerStepButton | Image | reader_tts_make_minus_theme_night / reader_tts_make_minus / reader_tts_make_plus_theme_night / reader_tts_make_plus | width(12); height(12) |
| [ReaderControlTtsContent.ets:869](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlTtsContent.ets:869) / ttsServiceTypeTab | Image | reader_tts_online_engine_theme_night / reader_tts_online_engine / reader_tts_system_engine_theme_night / reader_tts_system_engine | width(20); height(20) |
| [ReaderControlTtsContent.ets:871](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlTtsContent.ets:871) / ttsServiceTypeTab | Image | reader_tts_make_engine_check_theme_night / reader_tts_make_engine_check | width(16); height(16) |
| [ReaderControlTtsContent.ets:937](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlTtsContent.ets:937) / ttsSelectValueField | Image | reader_appearance_make_chevron_theme_night / reader_appearance_make_chevron | width(12); height(12) |
| [ReaderControlTtsContent.ets:1107](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlTtsContent.ets:1107) / onlineServiceInfoRow | Image | reader_appearance_make_chevron_theme_night / reader_appearance_make_chevron | width(12); height(12) |

### ReaderDirectoryChapterRow.ets

| 源位置/Builder | 类型 | 资源/表达式 | 叶节点参数 |
| --- | --- | --- | --- |
| [ReaderDirectoryChapterRow.ets:46](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryChapterRow.ets:46) / build | Image | reader_directory_marker_check_theme_night / reader_directory_marker_check / reader_directory_marker_download_theme_night / reader_directory_marker_download | width(15); height(15) |
| [ReaderDirectoryChapterRow.ets:55](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryChapterRow.ets:55) / build | Image | reader_directory_marker_bookmark_active_theme_night / reader_directory_marker_bookmark_active / reader_directory_marker_bookmark_theme_night / reader_directory_marker_bookmark | width(15); height(15) |

### ReaderDirectoryModulePanel.ets

| 源位置/Builder | 类型 | 资源/表达式 | 叶节点参数 |
| --- | --- | --- | --- |
| [ReaderDirectoryModulePanel.ets:282](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryModulePanel.ets:282) / downloadMarkerHitTarget | Image | $r(`app.media.${this.downloadMarker(entry)}`) | width(DIRECTORY_MARKER_ICON_SIZE); height(DIRECTORY_MARKER_ICON_SIZE) |
| [ReaderDirectoryModulePanel.ets:299](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryModulePanel.ets:299) / statusMarkerHitTarget | Image | reader_directory_marker_check_theme_night / reader_directory_marker_check | width(DIRECTORY_MARKER_ICON_SIZE); height(DIRECTORY_MARKER_ICON_SIZE) |
| [ReaderDirectoryModulePanel.ets:317](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryModulePanel.ets:317) / bookmarkMarkerHitTarget | Image | reader_directory_marker_bookmark_active_theme_night / reader_directory_marker_bookmark_active | width(DIRECTORY_MARKER_ICON_SIZE); height(DIRECTORY_MARKER_ICON_SIZE) |

### ReaderDirectoryNavigationList.ets

| 源位置/Builder | 类型 | 资源/表达式 | 叶节点参数 |
| --- | --- | --- | --- |
| [ReaderDirectoryNavigationList.ets:1034](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryNavigationList.ets:1034) / mangaNumberCell | Image | reader_directory_marker_check_theme_night / reader_directory_marker_check / reader_directory_marker_download_theme_night / reader_directory_marker_download | width(12); height(12) |
| [ReaderDirectoryNavigationList.ets:1049](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryNavigationList.ets:1049) / mangaNumberCell | Image | manga_sheet_locate_theme_night / manga_sheet_locate | width(MANGA_DIRECTORY_VISUAL.gridMarkSize); height(MANGA_DIRECTORY_VISUAL.gridMarkSize); hitTestBehavior(HitTestMode.None); accessibilityLevel('no') |
| [ReaderDirectoryNavigationList.ets:1077](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryNavigationList.ets:1077) / mangaRow | Image | manga_sheet_chevron_down_theme_night / manga_sheet_chevron_down | width(MANGA_DIRECTORY_VISUAL.groupIconSize); height(MANGA_DIRECTORY_VISUAL.groupIconSize); rotate({ angle: this.mangaGroupNode(item.node).expanded ? 0 : -90 }) |
| [ReaderDirectoryNavigationList.ets:1098](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryNavigationList.ets:1098) / mangaRowBody | Text | '…' | fontSize(13); fontColor(this.mangaColor('muted')) |
| [ReaderDirectoryNavigationList.ets:1147](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryNavigationList.ets:1147) / mangaRowBody | Image | reader_directory_marker_check_theme_night / reader_directory_marker_check / reader_directory_marker_download_theme_night / reader_directory_marker_download | width(15); height(15) |
| [ReaderDirectoryNavigationList.ets:1162](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryNavigationList.ets:1162) / mangaRowBody | Image | manga_sheet_chevron_down_theme_night / manga_sheet_chevron_down | width(16); height(16); rotate({ angle: this.mangaGroupNode(item.node).expanded ? 0 : -90 }) |
| [ReaderDirectoryNavigationList.ets:1173](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryNavigationList.ets:1173) / mangaRowBody | Image | manga_sheet_chevron_right_theme_night / manga_sheet_chevron_right | width(13); height(13) |
| [ReaderDirectoryNavigationList.ets:1210](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryNavigationList.ets:1210) / row | Text | '…' | fontSize(TYPE_APP_INHERITED_HINT.fontSizeFp); fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme)) |
| [ReaderDirectoryNavigationList.ets:1244](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryNavigationList.ets:1244) / row | Image | reader_directory_marker_check_theme_night / reader_directory_marker_check / reader_directory_marker_download_theme_night / reader_directory_marker_download | width(15); height(15) |
| [ReaderDirectoryNavigationList.ets:1257](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryNavigationList.ets:1257) / row | Image | reader_directory_marker_bookmark_active_theme_night / reader_directory_marker_bookmark_active / reader_directory_marker_bookmark_theme_night / reader_directory_marker_bookmark | width(15); height(15) |

### ReaderDirectoryToolbar.ets

| 源位置/Builder | 类型 | 资源/表达式 | 叶节点参数 |
| --- | --- | --- | --- |
| [ReaderDirectoryToolbar.ets:38](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryToolbar.ets:38) / tool | Image | this.icon(kind) | width(24); height(24) |
| [ReaderDirectoryToolbar.ets:45](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryToolbar.ets:45) / tool | Image | reader_directory_search_theme_night | width(24); height(24) |
| [ReaderDirectoryToolbar.ets:47](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryToolbar.ets:47) / tool | Image | reader_directory_search | width(24); height(24) |
| [ReaderDirectoryToolbar.ets:51](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryToolbar.ets:51) / tool | Image | reader_directory_top_theme_night | width(24); height(24) |
| [ReaderDirectoryToolbar.ets:53](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryToolbar.ets:53) / tool | Image | reader_directory_top | width(24); height(24) |
| [ReaderDirectoryToolbar.ets:57](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryToolbar.ets:57) / tool | Image | reader_directory_bottom_theme_night | width(24); height(24) |
| [ReaderDirectoryToolbar.ets:59](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryToolbar.ets:59) / tool | Image | reader_directory_bottom | width(24); height(24) |
| [ReaderDirectoryToolbar.ets:63](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryToolbar.ets:63) / tool | Image | reader_directory_sort_ascending_theme_night | width(24); height(24) |
| [ReaderDirectoryToolbar.ets:65](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryToolbar.ets:65) / tool | Image | reader_directory_sort_ascending | width(24); height(24) |
| [ReaderDirectoryToolbar.ets:69](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryToolbar.ets:69) / tool | Image | reader_directory_sort_descending_theme_night | width(24); height(24) |
| [ReaderDirectoryToolbar.ets:71](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryToolbar.ets:71) / tool | Image | reader_directory_sort_descending | width(24); height(24) |

### ReaderFullDirectory.ets

| 源位置/Builder | 类型 | 资源/表达式 | 叶节点参数 |
| --- | --- | --- | --- |
| [ReaderFullDirectory.ets:253](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderFullDirectory.ets:253) / topBar | Image | reader_directory_back_theme_night / reader_directory_back | width(24); height(24) |
| [ReaderFullDirectory.ets:289](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderFullDirectory.ets:289) / topBar | Image | reader_directory_switch_theme_night / reader_directory_switch | width(20); height(20) |
| [ReaderFullDirectory.ets:317](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderFullDirectory.ets:317) / topBar | Image | reader_directory_more_theme_night / reader_directory_more | width(20); height(20) |

### ReaderNativeParagraphView.ets

| 源位置/Builder | 类型 | 资源/表达式 | 叶节点参数 |
| --- | --- | --- | --- |
| [ReaderNativeParagraphView.ets:170](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderNativeParagraphView.ets:170) / build | Canvas | this.highlightCanvas() | width('100%'); height(this.localHighlightHeight); hitTestBehavior(HitTestMode.None) |

### ReaderPaperBackground.ets

| 源位置/Builder | 类型 | 资源/表达式 | 叶节点参数 |
| --- | --- | --- | --- |
| [ReaderPaperBackground.ets:22](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderPaperBackground.ets:22) / build | Image | this.paperShade() | width('100%'); height('100%') |
| [ReaderPaperBackground.ets:26](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderPaperBackground.ets:26) / build | Image | this.paperHighlight() | width('100%'); height('100%') |

### ReaderQuickSearchPanel.ets

| 源位置/Builder | 类型 | 资源/表达式 | 叶节点参数 |
| --- | --- | --- | --- |
| [ReaderQuickSearchPanel.ets:102](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderQuickSearchPanel.ets:102) / searchHeader | Image | reader_quick_back_theme_night / reader_quick_back | width(11); height(11) |

### ReaderReplaceQuickPanel.ets

| 源位置/Builder | 类型 | 资源/表达式 | 叶节点参数 |
| --- | --- | --- | --- |
| [ReaderReplaceQuickPanel.ets:110](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderReplaceQuickPanel.ets:110) / header | Image | reader_replace_close_theme_night / reader_replace_close | width(11); height(11) |
| [ReaderReplaceQuickPanel.ets:220](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderReplaceQuickPanel.ets:220) / footerButton | Image | reader_replace_preview_theme_night / reader_replace_preview / reader_replace_manage_theme_night / reader_replace_manage | width(11); height(11) |

### ReaderSearchFullPanel.ets

| 源位置/Builder | 类型 | 资源/表达式 | 叶节点参数 |
| --- | --- | --- | --- |
| [ReaderSearchFullPanel.ets:90](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderSearchFullPanel.ets:90) / header | Image | rc_search_theme_night / rc_search | width(16); height(16) |
| [ReaderSearchFullPanel.ets:136](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderSearchFullPanel.ets:136) / searchRow | Image | reader_directory_input_search_theme_night / reader_directory_input_search | width(16); height(16) |

### ReaderSessionCapsule.ets

| 源位置/Builder | 类型 | 资源/表达式 | 叶节点参数 |
| --- | --- | --- | --- |
| [ReaderSessionCapsule.ets:43](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderSessionCapsule.ets:43) / build | Image | reader_tts_headphones_theme_night / reader_tts_headphones | width(11); height(11) |
| [ReaderSessionCapsule.ets:85](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderSessionCapsule.ets:85) / build | Image | reader_session_pause_theme_night / reader_session_pause / reader_session_play_theme_night / reader_session_play | width(8); height(8) |

### ReaderSettingsFullPanel.ets

| 源位置/Builder | 类型 | 资源/表达式 | 叶节点参数 |
| --- | --- | --- | --- |
| [ReaderSettingsFullPanel.ets:113](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderSettingsFullPanel.ets:113) / header | Image | reader_settings_header_theme_night / reader_settings_header | width(20); height(20) |

### ReaderTtsConfigOverlay.ets

| 源位置/Builder | 类型 | 资源/表达式 | 叶节点参数 |
| --- | --- | --- | --- |
| [ReaderTtsConfigOverlay.ets:245](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsConfigOverlay.ets:245) / choiceRow | Image | reader_appearance_make_check_theme_night / reader_appearance_make_check | width(11); height(9) |

### ReaderTtsFullPanel.ets

| 源位置/Builder | 类型 | 资源/表达式 | 叶节点参数 |
| --- | --- | --- | --- |
| [ReaderTtsFullPanel.ets:163](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsFullPanel.ets:163) / header | Image | reader_tts_header_theme_night / reader_tts_header | width(20); height(20) |
| [ReaderTtsFullPanel.ets:278](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsFullPanel.ets:278) / roundControl | Image | reader_tts_play_theme_night / reader_tts_play | width(25); height(25) |
| [ReaderTtsFullPanel.ets:281](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsFullPanel.ets:281) / roundControl | Image | reader_tts_stop_theme_night / reader_tts_stop | width(28); height(28) |
| [ReaderTtsFullPanel.ets:283](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsFullPanel.ets:283) / roundControl | Image | reader_tts_previous_theme_night / reader_tts_previous / reader_tts_next_theme_night / reader_tts_next | width(22); height(18) |
| [ReaderTtsFullPanel.ets:358](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsFullPanel.ets:358) / timerSummaryBlock | Image | reader_tts_clock_theme_night / reader_tts_clock | width(20); height(20) |
| [ReaderTtsFullPanel.ets:575](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsFullPanel.ets:575) / ttsServiceTypeTab | Image | reader_tts_online_engine_theme_night / reader_tts_online_engine | width(16); height(16) |
| [ReaderTtsFullPanel.ets:579](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsFullPanel.ets:579) / ttsServiceTypeTab | Image | reader_tts_system_engine_theme_night / reader_tts_system_engine | width(16); height(16) |
| [ReaderTtsFullPanel.ets:725](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsFullPanel.ets:725) / ttsSelectValueField | Image | reader_chevron_down_theme_night / reader_chevron_down | width(8); height(4) |

### ReaderTtsModulePanel.ets

| 源位置/Builder | 类型 | 资源/表达式 | 叶节点参数 |
| --- | --- | --- | --- |
| [ReaderTtsModulePanel.ets:97](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsModulePanel.ets:97) / playbackRow | Image | reader_tts_headphones_theme_night / reader_tts_headphones | width(20); height(20) |
| [ReaderTtsModulePanel.ets:134](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsModulePanel.ets:134) / previousButton | Image | reader_tts_previous_theme_night / reader_tts_previous | width(20); height(16) |
| [ReaderTtsModulePanel.ets:156](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsModulePanel.ets:156) / playPauseButton | Image | reader_tts_play_theme_night / reader_tts_play | width(21); height(21) |
| [ReaderTtsModulePanel.ets:185](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsModulePanel.ets:185) / stopButton | Image | reader_tts_stop_theme_night / reader_tts_stop | width(26); height(26) |
| [ReaderTtsModulePanel.ets:203](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsModulePanel.ets:203) / nextButton | Image | reader_tts_next_theme_night / reader_tts_next | width(20); height(16) |
| [ReaderTtsModulePanel.ets:221](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsModulePanel.ets:221) / timerRow | Image | reader_tts_clock_theme_night / reader_tts_clock | width(20); height(20) |
| [ReaderTtsModulePanel.ets:241](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsModulePanel.ets:241) / timerRow | Image | reader_chevron_down_theme_night / reader_chevron_down | width(12); height(12) |
| [ReaderTtsModulePanel.ets:270](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsModulePanel.ets:270) / rateRow | Image | reader_tts_rate_theme_night / reader_tts_rate | width(20); height(20) |
| [ReaderTtsModulePanel.ets:318](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsModulePanel.ets:318) / rateSlider | Image | reader_tts_speed_thumb_theme_night / reader_tts_speed_thumb | width(TTS_MODULE_RATE_THUMB_SIZE); height(TTS_MODULE_RATE_THUMB_SIZE) |

### ReadingSurface.ets

| 源位置/Builder | 类型 | 资源/表达式 | 叶节点参数 |
| --- | --- | --- | --- |
| [ReadingSurface.ets:392](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReadingSurface.ets:392) / build | Image | fragment.fileUri | width(`${fragment.imageWidthBasisPoints / 100}%`); height(fragment.imageHeight) |
| [ReadingSurface.ets:399](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReadingSurface.ets:399) / build | Image | fragment.imageSource | width(`${fragment.imageWidthBasisPoints / 100}%`); height(fragment.imageHeight) |
| [ReadingSurface.ets:500](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReadingSurface.ets:500) / build | Canvas | this.highlightCanvas | width('100%'); height('100%'); hitTestBehavior(HitTestMode.None) |

### MainTabBar.ets

| 源位置/Builder | 类型 | 资源/表达式 | 叶节点参数 |
| --- | --- | --- | --- |
| [MainTabBar.ets:207](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/shell/MainTabBar.ets:207) / tabIcon | Image | $r(`app.media.${this.tabIconResource(key, active)}`) | width(24); height(24) |

### SourceSwitchProgress.ets

| 源位置/Builder | 类型 | 资源/表达式 | 叶节点参数 |
| --- | --- | --- | --- |
| [SourceSwitchProgress.ets:50](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/source/SourceSwitchProgress.ets:50) / build | SourceSwitchSpinner | { active: this.active, diameter: SOURCE_SWITCH_VISUAL.switchSpinnerSize, strokeWidth: SOURCE_SWITCH_VISUAL.switchSpinnerStrokeWidth, durationMs: SOURCE_SWITCH_VISUAL.switchSpinnerDurationMs, reduceMotion: this.reduceMotion } |  |
| [SourceSwitchProgress.ets:85](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/source/SourceSwitchProgress.ets:85) / build | Image | source_switch_close_theme_night / source_switch_close | width(SOURCE_SWITCH_VISUAL.closeIconSize); height(SOURCE_SWITCH_VISUAL.closeIconSize) |

### SourceSwitchSpinner.ets

| 源位置/Builder | 类型 | 资源/表达式 | 叶节点参数 |
| --- | --- | --- | --- |
| [SourceSwitchSpinner.ets:103](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/source/SourceSwitchSpinner.ets:103) / build | Path | { width: '36px', height: '36px' } | fill(readerAppColor('TOK_LINE', this.appThemeScheme)); strokeWidth(0) |
| [SourceSwitchSpinner.ets:105](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/source/SourceSwitchSpinner.ets:105) / build | Path | { width: '36px', height: '36px' } | fill(readerAppColor('TOK_PRIMARY_DARK', this.appThemeScheme)); strokeWidth(0) |

### SourceSwitchWindow.ets

| 源位置/Builder | 类型 | 资源/表达式 | 叶节点参数 |
| --- | --- | --- | --- |
| [SourceSwitchWindow.ets:173](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/source/SourceSwitchWindow.ets:173) / build | Text | '—' | fontSize(TYPE_SOURCE_SWITCH_NOVEL_LATENCY.fontSizeFp); fontColor(readerAppColor('TOK_INK', this.appThemeScheme)); width(this.timingColumnWidth) |
| [SourceSwitchWindow.ets:635](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/source/SourceSwitchWindow.ets:635) / novelHeading | Image | source_switch_close_theme_night / source_switch_close | width(SOURCE_SWITCH_VISUAL.closeIconSize); height(SOURCE_SWITCH_VISUAL.closeIconSize) |
| [SourceSwitchWindow.ets:646](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/source/SourceSwitchWindow.ets:646) / novelBookContext | Image | this.coverUrl | width(this.compactWindow() ? SOURCE_SWITCH_VISUAL.compactCoverWidth : SOURCE_SWITCH_VISUAL.coverWidth); height(this.compactWindow() ? SOURCE_SWITCH_VISUAL.compactCoverHeight : SOURCE_SWITCH_VISUAL.coverHeight) |
| [SourceSwitchWindow.ets:681](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/source/SourceSwitchWindow.ets:681) / novelDiscovery | SourceSwitchSpinner | { active: this.foreground, diameter: SOURCE_SWITCH_VISUAL.discoverySpinnerSize, strokeWidth: SOURCE_SWITCH_VISUAL.discoverySpinnerStrokeWidth, durationMs: SOURCE_SWITCH_VISUAL.discoverySpinnerDurationMs, reduceMotion: this.reduceMotion } |  |
| [SourceSwitchWindow.ets:684](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/source/SourceSwitchWindow.ets:684) / novelDiscovery | Image | search_mag_theme_night / search_mag | width(SOURCE_SWITCH_VISUAL.discoverySpinnerSize); height(SOURCE_SWITCH_VISUAL.discoverySpinnerSize); accessibilityLevel('no') |
| [SourceSwitchWindow.ets:716](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/source/SourceSwitchWindow.ets:716) / novelDiscovery | Image | settings_gen_refresh_theme_night / settings_gen_refresh | width(SOURCE_SWITCH_VISUAL.discoveryActionIconSize); height(SOURCE_SWITCH_VISUAL.discoveryActionIconSize); accessibilityLevel('no') |

## 附表 B：本范围所有字面资源及使用位置

涵盖 helper 返回资源；动态拼接 rc/module/download-marker 名称另见组件表及 source-index.json。SVG 颜色指实际 stroke/fill 属性集合，包含裁剪白底时不据此判图标有白色前景；资源表不据此宣称所有资源已可见。

| 资源 | 本范围调用位置 | SVG颜色 / 原始stroke / viewBox |
| --- | --- | --- |
| book_detail_back | [MangaReadingSurface.ets:2135](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2135) | #1F1B17; stroke 3.5; 0 0 48 48 |
| book_detail_back_theme_night | [MangaReadingSurface.ets:2135](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2135) | #EADFCE; stroke 3.5; 0 0 48 48 |
| bookshelf_more_import | [MangaReadingSurface.ets:2722](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2722) | #1F1B17; stroke 1.75; 0 0 24 24 |
| bookshelf_more_import_theme_night | [MangaReadingSurface.ets:2722](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2722) | #EADFCE; stroke 1.75; 0 0 24 24 |
| download_visual_clear | [MangaDownloadOperationsPanel.ets:58](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaDownloadOperationsPanel.ets:58) | #1F1B17; stroke 2; 0 0 24 24 |
| download_visual_clear_theme_night | [MangaDownloadOperationsPanel.ets:58](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaDownloadOperationsPanel.ets:58) | #EAE7DE; stroke 2; 0 0 24 24 |
| download_visual_close | [MangaDownloadOperationsPanel.ets:54](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaDownloadOperationsPanel.ets:54) | #1F1B17; stroke 2; 0 0 24 24 |
| download_visual_close_theme_night | [MangaDownloadOperationsPanel.ets:54](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaDownloadOperationsPanel.ets:54) | #EAE7DE; stroke 2; 0 0 24 24 |
| download_visual_download | [MangaDownloadOperationsPanel.ets:59](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaDownloadOperationsPanel.ets:59), [MangaReadingSurface.ets:2711](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2711) | #756F69; stroke 2; 0 0 24 24 |
| download_visual_download_theme_night | [MangaDownloadOperationsPanel.ets:59](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaDownloadOperationsPanel.ets:59), [MangaReadingSurface.ets:2711](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2711) | #ABA99F; stroke 2; 0 0 24 24 |
| download_visual_more | [MangaReadingSurface.ets:2715](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2715) | #1F1B17; stroke 2; 0 0 24 24 |
| download_visual_more_theme_night | [MangaReadingSurface.ets:2715](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2715) | #EAE7DE; stroke 2; 0 0 24 24 |
| download_visual_pause | [MangaDownloadOperationsPanel.ets:52](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaDownloadOperationsPanel.ets:52) | #1F3528; stroke 2; 0 0 24 24 |
| download_visual_pause_theme_night | [MangaDownloadOperationsPanel.ets:52](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaDownloadOperationsPanel.ets:52) | #B9CEB1; stroke 2; 0 0 24 24 |
| download_visual_play | [MangaDownloadOperationsPanel.ets:53](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaDownloadOperationsPanel.ets:53) | #1F3528; stroke 2; 0 0 24 24 |
| download_visual_play_theme_night | [MangaDownloadOperationsPanel.ets:53](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaDownloadOperationsPanel.ets:53) | #B9CEB1; stroke 2; 0 0 24 24 |
| download_visual_retry | [MangaDownloadOperationsPanel.ets:55](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaDownloadOperationsPanel.ets:55), [MangaReadingSurface.ets:2704](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2704) | #A53D32; stroke 2; 0 0 24 24 |
| download_visual_retry_theme_night | [MangaDownloadOperationsPanel.ets:55](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaDownloadOperationsPanel.ets:55), [MangaReadingSurface.ets:2704](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2704) | #EFB4A8; stroke 2; 0 0 24 24 |
| download_visual_storage | [MangaDownloadOperationsPanel.ets:56](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaDownloadOperationsPanel.ets:56), [MangaReadingSurface.ets:2713](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2713) | #1F1B17; stroke 2; 0 0 24 24 |
| download_visual_storage_theme_night | [MangaDownloadOperationsPanel.ets:56](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaDownloadOperationsPanel.ets:56), [MangaReadingSurface.ets:2713](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2713) | #EAE7DE; stroke 2; 0 0 24 24 |
| download_visual_trash | [MangaDownloadOperationsPanel.ets:57](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaDownloadOperationsPanel.ets:57), [MangaReadingSurface.ets:2721](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2721) | #FFFCF8; stroke 2; 0 0 24 24 |
| download_visual_trash_theme_night | [MangaDownloadOperationsPanel.ets:57](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaDownloadOperationsPanel.ets:57), [MangaReadingSurface.ets:2721](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2721) | #1C1E1A; stroke 2; 0 0 24 24 |
| manga_directory_chevron_right_accent | [MangaReadingSurface.ets:2398](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2398), [MangaReadingSurface.ets:2402](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2402) | #425D45; stroke fill-path; 0 0 15 15 |
| manga_directory_chevron_right_accent_theme_night | [MangaReadingSurface.ets:2398](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2398), [MangaReadingSurface.ets:2402](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2402) | #B9CEB1; stroke fill-path; 0 0 15 15 |
| manga_directory_previous | [MangaReadingSurface.ets:2390](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2390) | #425D45; stroke fill-path; 0 0 15 15 |
| manga_directory_previous_theme_night | [MangaReadingSurface.ets:2390](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2390) | #B9CEB1; stroke fill-path; 0 0 15 15 |
| manga_sheet_check | [MangaReadingSurface.ets:2652](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2652) | #425D45; stroke fill-path; 0 0 15 15 |
| manga_sheet_check_theme_night | [MangaReadingSurface.ets:2652](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2652) | #B9CEB1; stroke fill-path; 0 0 15 15 |
| manga_sheet_chevron_down | [MangaDirectoryEntryRow.ets:183](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaDirectoryEntryRow.ets:183), [ReaderDirectoryNavigationList.ets:1078](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryNavigationList.ets:1078), [ReaderDirectoryNavigationList.ets:1163](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryNavigationList.ets:1163) | #756F69; stroke fill-path; 0 0 15 15 |
| manga_sheet_chevron_down_theme_night | [MangaDirectoryEntryRow.ets:182](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaDirectoryEntryRow.ets:182), [ReaderDirectoryNavigationList.ets:1078](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryNavigationList.ets:1078), [ReaderDirectoryNavigationList.ets:1163](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryNavigationList.ets:1163) | #ABA99F; stroke fill-path; 0 0 15 15 |
| manga_sheet_chevron_right | [MangaDirectoryEntryRow.ets:264](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaDirectoryEntryRow.ets:264), [ReaderDirectoryNavigationList.ets:1174](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryNavigationList.ets:1174) | #A39C90; stroke fill-path; 0 0 15 15 |
| manga_sheet_chevron_right_theme_night | [MangaDirectoryEntryRow.ets:263](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaDirectoryEntryRow.ets:263), [ReaderDirectoryNavigationList.ets:1174](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryNavigationList.ets:1174) | #767D71; stroke fill-path; 0 0 15 15 |
| manga_sheet_close | [MangaReadingSurface.ets:2239](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2239), [MangaReadingSurface.ets:2296](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2296) | #756F69; stroke fill-path; 0 0 15 15 |
| manga_sheet_close_theme_night | [MangaReadingSurface.ets:2239](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2239), [MangaReadingSurface.ets:2296](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2296) | #ABA99F; stroke fill-path; 0 0 15 15 |
| manga_sheet_horizontal | [MangaReadingSurface.ets:1763](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:1763) | #756F69; stroke fill-path; 0 0 15 15 |
| manga_sheet_horizontal_active | [MangaReadingSurface.ets:1763](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:1763) | #FFFAF4; stroke fill-path; 0 0 15 15 |
| manga_sheet_horizontal_theme_night | [MangaReadingSurface.ets:1763](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:1763) | #ABA99F; stroke fill-path; 0 0 15 15 |
| manga_sheet_locate | [MangaDirectoryEntryRow.ets:165](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaDirectoryEntryRow.ets:165), [ReaderDirectoryNavigationList.ets:1050](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryNavigationList.ets:1050) | #425D45; stroke fill-path; 0 0 15 15 |
| manga_sheet_locate_theme_night | [MangaDirectoryEntryRow.ets:165](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaDirectoryEntryRow.ets:165), [ReaderDirectoryNavigationList.ets:1050](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryNavigationList.ets:1050) | #B9CEB1; stroke fill-path; 0 0 15 15 |
| manga_sheet_moon | [MangaReadingSurface.ets:1765](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:1765) | #756F69; stroke fill-path; 0 0 15 15 |
| manga_sheet_moon_active | [MangaReadingSurface.ets:1765](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:1765) | #FFFAF4; stroke fill-path; 0 0 15 15 |
| manga_sheet_moon_theme_night | [MangaReadingSurface.ets:1765](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:1765) | #ABA99F; stroke fill-path; 0 0 15 15 |
| manga_sheet_sun | [MangaReadingSurface.ets:1764](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:1764) | #756F69; stroke fill-path; 0 0 15 15 |
| manga_sheet_sun_active | [MangaReadingSurface.ets:1764](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:1764) | #FFFAF4; stroke fill-path; 0 0 15 15 |
| manga_sheet_sun_theme_night | [MangaReadingSurface.ets:1764](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:1764) | #ABA99F; stroke fill-path; 0 0 15 15 |
| manga_sheet_vertical | [MangaReadingSurface.ets:1762](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:1762) | #756F69; stroke fill-path; 0 0 15 15 |
| manga_sheet_vertical_active | [MangaReadingSurface.ets:1762](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:1762) | #FFFAF4; stroke fill-path; 0 0 15 15 |
| manga_sheet_vertical_theme_night | [MangaReadingSurface.ets:1762](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:1762) | #ABA99F; stroke fill-path; 0 0 15 15 |
| rc_list | [ReaderControlDirectoryContent.ets:322](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlDirectoryContent.ets:322) | #2F6373; stroke 3.5; 0 0 48 48 |
| rc_list_theme_night | [ReaderControlDirectoryContent.ets:322](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlDirectoryContent.ets:322) | #D2BD96; stroke 3.5; 0 0 48 48 |
| rc_search | [ReaderSearchFullPanel.ets:90](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderSearchFullPanel.ets:90) | #332C25; stroke 3.5; 0 0 48 48 |
| rc_search_theme_night | [ReaderSearchFullPanel.ets:90](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderSearchFullPanel.ets:90) | #EADFCE; stroke 3.5; 0 0 48 48 |
| reader_appearance_header | [MangaReadingSurface.ets:2195](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2195), [ReaderAppearanceFullPanel.ets:346](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderAppearanceFullPanel.ets:346) | #332C25; stroke 3.5; 0 0 48 48 |
| reader_appearance_header_theme_night | [MangaReadingSurface.ets:2195](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2195), [ReaderAppearanceFullPanel.ets:346](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderAppearanceFullPanel.ets:346) | #EADFCE; stroke 3.5; 0 0 48 48 |
| reader_appearance_make_check | [ReaderTtsConfigOverlay.ets:245](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsConfigOverlay.ets:245) | #2f6373; stroke 1.4; 0 0 11 9 |
| reader_appearance_make_check_theme_night | [ReaderTtsConfigOverlay.ets:245](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsConfigOverlay.ets:245) | #D2BD96; stroke 1.4; 0 0 11 9 |
| reader_auto_full_clock | [ReaderAutoPageFullPanel.ets:494](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderAutoPageFullPanel.ets:494) | #1F1B17; stroke 3.5; 0 0 48 48 |
| reader_auto_full_clock_theme_night | [ReaderAutoPageFullPanel.ets:494](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderAutoPageFullPanel.ets:494) | #EADFCE; stroke 3.5; 0 0 48 48 |
| reader_auto_full_header | [ReaderAutoPageFullPanel.ets:205](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderAutoPageFullPanel.ets:205) | #332C25; stroke 3.5; 0 0 48 48 |
| reader_auto_full_header_theme_night | [ReaderAutoPageFullPanel.ets:205](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderAutoPageFullPanel.ets:205) | #EADFCE; stroke 3.5; 0 0 48 48 |
| reader_auto_full_stop | [ReaderAutoPageFullPanel.ets:426](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderAutoPageFullPanel.ets:426) | #2F6373; stroke 3.5; 0 0 48 48 |
| reader_auto_full_stop_theme_night | [ReaderAutoPageFullPanel.ets:426](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderAutoPageFullPanel.ets:426) | #D2BD96; stroke 3.5; 0 0 48 48 |
| reader_auto_stop | [ReaderAutoPagePanel.ets:274](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderAutoPagePanel.ets:274) | #8C3D36; stroke 3.5; 0 0 48 48 |
| reader_chevron_down | [ReaderTtsFullPanel.ets:725](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsFullPanel.ets:725), [ReaderTtsModulePanel.ets:241](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsModulePanel.ets:241) | #41484C; stroke 3.5; 0 0 48 48 |
| reader_chevron_down_primary | [ReaderAppearanceFullPanel.ets:786](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderAppearanceFullPanel.ets:786) | #2F6373; stroke 3.5; 0 0 48 48 |
| reader_chevron_down_primary_theme_night | [ReaderAppearanceFullPanel.ets:786](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderAppearanceFullPanel.ets:786) | #D2BD96; stroke 3.5; 0 0 48 48 |
| reader_chevron_down_theme_night | [ReaderTtsFullPanel.ets:725](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsFullPanel.ets:725), [ReaderTtsModulePanel.ets:241](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsModulePanel.ets:241) | #EADFCE; stroke 3.5; 0 0 48 48 |
| reader_control_replace_add | [ReaderControlReplaceContent.ets:365](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlReplaceContent.ets:365) | 无显式HEX; stroke 1.45833; 0 0 20 20 |
| reader_control_replace_back | [ReaderControlReplaceContent.ets:342](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlReplaceContent.ets:342) | #2F6373; stroke 0.802083; 0 0 11 11 |
| reader_control_replace_back_theme_night | [ReaderControlReplaceContent.ets:342](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlReplaceContent.ets:342) | #D2BD96; stroke 0.802083; 0 0 11 11 |
| reader_control_replace_delete | [ReaderControlReplaceContent.ets:410](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlReplaceContent.ets:410) | #332C25; stroke 1.45833; 0 0 20 20 |
| reader_control_replace_delete_theme_night | [ReaderControlReplaceContent.ets:410](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlReplaceContent.ets:410) | #EADFCE; stroke 1.45833; 0 0 20 20 |
| reader_control_replace_edit | [ReaderControlReplaceContent.ets:408](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlReplaceContent.ets:408) | #332C25; stroke 1.45833; 0 0 20 20 |
| reader_control_replace_edit_theme_night | [ReaderControlReplaceContent.ets:408](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlReplaceContent.ets:408) | #EADFCE; stroke 1.45833; 0 0 20 20 |
| reader_control_replace_export | [ReaderControlReplaceContent.ets:367](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlReplaceContent.ets:367) | #332C25; stroke 1.45833; 0 0 20 20 |
| reader_control_replace_export_theme_night | [ReaderControlReplaceContent.ets:367](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlReplaceContent.ets:367) | #EADFCE; stroke 1.45833; 0 0 20 20 |
| reader_control_replace_import | [ReaderControlReplaceContent.ets:366](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlReplaceContent.ets:366) | #332C25; stroke 1.45833; 0 0 20 20 |
| reader_control_replace_import_theme_night | [ReaderControlReplaceContent.ets:366](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlReplaceContent.ets:366) | #EADFCE; stroke 1.45833; 0 0 20 20 |
| reader_directory_back | [ReaderFullDirectory.ets:253](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderFullDirectory.ets:253) | #332C25; stroke 3.5; 0 0 48 48 |
| reader_directory_back_theme_night | [ReaderFullDirectory.ets:253](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderFullDirectory.ets:253) | #EADFCE; stroke 3.5; 0 0 48 48 |
| reader_directory_bottom | [FullDirectoryPanel.ets:633](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/FullDirectoryPanel.ets:633), [ReaderDirectoryToolbar.ets:26](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryToolbar.ets:26), [ReaderDirectoryToolbar.ets:59](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryToolbar.ets:59) | #2F6373; stroke 3.5; 0 0 48 48 |
| reader_directory_bottom_theme_night | [FullDirectoryPanel.ets:633](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/FullDirectoryPanel.ets:633), [ReaderDirectoryToolbar.ets:26](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryToolbar.ets:26), [ReaderDirectoryToolbar.ets:57](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryToolbar.ets:57) | #D2BD96; stroke 3.5; 0 0 48 48 |
| reader_directory_directory | [MangaReadingSurface.ets:2194](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2194), [FullDirectoryPanel.ets:398](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/FullDirectoryPanel.ets:398), [ReaderControlDirectoryContent.ets:323](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlDirectoryContent.ets:323) | #332C25; stroke 3.5; 0 0 48 48 |
| reader_directory_directory_theme_night | [MangaReadingSurface.ets:2194](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2194), [FullDirectoryPanel.ets:398](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/FullDirectoryPanel.ets:398), [ReaderControlDirectoryContent.ets:323](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlDirectoryContent.ets:323) | #EADFCE; stroke 3.5; 0 0 48 48 |
| reader_directory_input_search | [ReaderSearchFullPanel.ets:136](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderSearchFullPanel.ets:136) | #5B5046; stroke 3.5; 0 0 48 48 |
| reader_directory_input_search_theme_night | [ReaderSearchFullPanel.ets:136](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderSearchFullPanel.ets:136) | #BAAD9C; stroke 3.5; 0 0 48 48 |
| reader_directory_marker_bookmark | [FullDirectoryPanel.ets:394](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/FullDirectoryPanel.ets:394), [FullDirectoryPanel.ets:547](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/FullDirectoryPanel.ets:547), [ReaderBookmarkEmptyState.ets:11](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderBookmarkEmptyState.ets:11), [ReaderControlDirectoryContent.ets:326](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlDirectoryContent.ets:326), [ReaderDirectoryChapterRow.ets:56](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryChapterRow.ets:56), [ReaderDirectoryNavigationList.ets:1259](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryNavigationList.ets:1259) | #5B5046; stroke 3.5; 0 0 48 48 |
| reader_directory_marker_bookmark_active | [FullDirectoryPanel.ets:543](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/FullDirectoryPanel.ets:543), [LocalReadingExperience.ets:13054](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/LocalReadingExperience.ets:13054), [ReaderBookmarkRow.ets:85](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderBookmarkRow.ets:85), [ReaderControlDirectoryContent.ets:325](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlDirectoryContent.ets:325), [ReaderDirectoryChapterRow.ets:55](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryChapterRow.ets:55), [ReaderDirectoryModulePanel.ets:317](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryModulePanel.ets:317), [ReaderDirectoryNavigationList.ets:1258](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryNavigationList.ets:1258) | #2F6373; stroke 3.5; 0 0 48 48 |
| reader_directory_marker_bookmark_active_theme_night | [FullDirectoryPanel.ets:543](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/FullDirectoryPanel.ets:543), [LocalReadingExperience.ets:13053](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/LocalReadingExperience.ets:13053), [ReaderBookmarkRow.ets:85](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderBookmarkRow.ets:85), [ReaderControlDirectoryContent.ets:325](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlDirectoryContent.ets:325), [ReaderDirectoryChapterRow.ets:55](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryChapterRow.ets:55), [ReaderDirectoryModulePanel.ets:317](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryModulePanel.ets:317), [ReaderDirectoryNavigationList.ets:1258](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryNavigationList.ets:1258) | #D2BD96; stroke 3.5; 0 0 48 48 |
| reader_directory_marker_bookmark_theme_night | [FullDirectoryPanel.ets:394](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/FullDirectoryPanel.ets:394), [FullDirectoryPanel.ets:547](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/FullDirectoryPanel.ets:547), [ReaderBookmarkEmptyState.ets:11](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderBookmarkEmptyState.ets:11), [ReaderControlDirectoryContent.ets:326](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlDirectoryContent.ets:326), [ReaderDirectoryChapterRow.ets:56](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryChapterRow.ets:56), [ReaderDirectoryNavigationList.ets:1259](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryNavigationList.ets:1259) | #BAAD9C; stroke 3.5; 0 0 48 48 |
| reader_directory_marker_check | [MangaDirectoryEntryRow.ets:119](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaDirectoryEntryRow.ets:119), [MangaReadingSurface.ets:2764](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2764), [ReaderDirectoryChapterRow.ets:46](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryChapterRow.ets:46), [ReaderDirectoryModulePanel.ets:299](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryModulePanel.ets:299), [ReaderDirectoryNavigationList.ets:1036](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryNavigationList.ets:1036), [ReaderDirectoryNavigationList.ets:1149](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryNavigationList.ets:1149), [ReaderDirectoryNavigationList.ets:1245](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryNavigationList.ets:1245) | #2F6373; stroke 3.5; 0 0 48 48 |
| reader_directory_marker_check_theme_night | [MangaDirectoryEntryRow.ets:119](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaDirectoryEntryRow.ets:119), [MangaReadingSurface.ets:2764](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2764), [ReaderDirectoryChapterRow.ets:46](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryChapterRow.ets:46), [ReaderDirectoryModulePanel.ets:299](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryModulePanel.ets:299), [ReaderDirectoryNavigationList.ets:1036](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryNavigationList.ets:1036), [ReaderDirectoryNavigationList.ets:1149](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryNavigationList.ets:1149), [ReaderDirectoryNavigationList.ets:1245](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryNavigationList.ets:1245) | #D2BD96; stroke 3.5; 0 0 48 48 |
| reader_directory_marker_download | [MangaDirectoryEntryRow.ets:120](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaDirectoryEntryRow.ets:120), [ReaderDirectoryChapterRow.ets:47](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryChapterRow.ets:47), [ReaderDirectoryNavigationList.ets:1038](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryNavigationList.ets:1038), [ReaderDirectoryNavigationList.ets:1151](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryNavigationList.ets:1151), [ReaderDirectoryNavigationList.ets:1246](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryNavigationList.ets:1246) | #5B5046; stroke 3.5; 0 0 48 48 |
| reader_directory_marker_download_theme_night | [MangaDirectoryEntryRow.ets:120](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaDirectoryEntryRow.ets:120), [ReaderDirectoryChapterRow.ets:47](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryChapterRow.ets:47), [ReaderDirectoryNavigationList.ets:1038](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryNavigationList.ets:1038), [ReaderDirectoryNavigationList.ets:1151](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryNavigationList.ets:1151), [ReaderDirectoryNavigationList.ets:1246](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryNavigationList.ets:1246) | #BAAD9C; stroke 3.5; 0 0 48 48 |
| reader_directory_more | [MangaReadingSurface.ets:2149](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2149), [ReaderFullDirectory.ets:317](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderFullDirectory.ets:317) | #332C25; stroke 3.5; 0 0 48 48 |
| reader_directory_more_theme_night | [MangaReadingSurface.ets:2149](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2149), [ReaderFullDirectory.ets:317](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderFullDirectory.ets:317) | #EADFCE; stroke 3.5; 0 0 48 48 |
| reader_directory_search | [FullDirectoryPanel.ets:629](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/FullDirectoryPanel.ets:629), [ReaderControlSearchContent.ets:406](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlSearchContent.ets:406), [ReaderDirectoryToolbar.ets:22](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryToolbar.ets:22), [ReaderDirectoryToolbar.ets:47](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryToolbar.ets:47) | #2F6373; stroke 3.5; 0 0 48 48 |
| reader_directory_search_theme_night | [FullDirectoryPanel.ets:629](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/FullDirectoryPanel.ets:629), [ReaderControlSearchContent.ets:406](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlSearchContent.ets:406), [ReaderDirectoryToolbar.ets:22](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryToolbar.ets:22), [ReaderDirectoryToolbar.ets:45](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryToolbar.ets:45) | #D2BD96; stroke 3.5; 0 0 48 48 |
| reader_directory_sort_ascending | [FullDirectoryPanel.ets:636](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/FullDirectoryPanel.ets:636), [ReaderDirectoryToolbar.ets:28](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryToolbar.ets:28), [ReaderDirectoryToolbar.ets:65](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryToolbar.ets:65) | #2F6373; stroke 3.5; 0 0 48 48 |
| reader_directory_sort_ascending_theme_night | [FullDirectoryPanel.ets:636](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/FullDirectoryPanel.ets:636), [ReaderDirectoryToolbar.ets:28](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryToolbar.ets:28), [ReaderDirectoryToolbar.ets:63](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryToolbar.ets:63) | #D2BD96; stroke 3.5; 0 0 48 48 |
| reader_directory_sort_descending | [FullDirectoryPanel.ets:640](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/FullDirectoryPanel.ets:640), [ReaderDirectoryToolbar.ets:30](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryToolbar.ets:30), [ReaderDirectoryToolbar.ets:71](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryToolbar.ets:71) | #2F6373; stroke 3.5; 0 0 48 48 |
| reader_directory_sort_descending_theme_night | [FullDirectoryPanel.ets:640](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/FullDirectoryPanel.ets:640), [ReaderDirectoryToolbar.ets:30](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryToolbar.ets:30), [ReaderDirectoryToolbar.ets:69](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryToolbar.ets:69) | #D2BD96; stroke 3.5; 0 0 48 48 |
| reader_directory_switch | [MangaReadingSurface.ets:2144](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2144), [MangaReadingSurface.ets:2702](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2702), [ReaderFullDirectory.ets:289](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderFullDirectory.ets:289) | #332C25; stroke 3.5; 0 0 48 48 |
| reader_directory_switch_theme_night | [MangaReadingSurface.ets:2144](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2144), [MangaReadingSurface.ets:2702](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2702), [ReaderFullDirectory.ets:289](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderFullDirectory.ets:289) | #EADFCE; stroke 3.5; 0 0 48 48 |
| reader_directory_top | [FullDirectoryPanel.ets:631](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/FullDirectoryPanel.ets:631), [ReaderDirectoryToolbar.ets:24](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryToolbar.ets:24), [ReaderDirectoryToolbar.ets:53](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryToolbar.ets:53) | #2F6373; stroke 3.5; 0 0 48 48 |
| reader_directory_top_theme_night | [FullDirectoryPanel.ets:631](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/FullDirectoryPanel.ets:631), [ReaderDirectoryToolbar.ets:24](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryToolbar.ets:24), [ReaderDirectoryToolbar.ets:51](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryToolbar.ets:51) | #D2BD96; stroke 3.5; 0 0 48 48 |
| reader_image_unavailable | [MangaReadingSurface.ets:2062](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2062) | #817A70; stroke 2; 0 0 24 24 |
| reader_image_unavailable_theme_night | [MangaReadingSurface.ets:2062](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2062) | #AFA79A; stroke 2; 0 0 24 24 |
| reader_page_bookmark_filled | [LocalReadingExperience.ets:13052](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/LocalReadingExperience.ets:13052) | #2F6373; stroke 3.5; 0 0 48 48 |
| reader_page_bookmark_filled_theme_night | [LocalReadingExperience.ets:13052](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/LocalReadingExperience.ets:13052) | #D2BD96; stroke 3.5; 0 0 48 48 |
| reader_quick_back | [ReaderAutoPageFullPanel.ets:248](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderAutoPageFullPanel.ets:248), [ReaderAutoPagePanel.ets:114](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderAutoPagePanel.ets:114), [ReaderControlSearchContent.ets:421](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlSearchContent.ets:421), [ReaderQuickSearchPanel.ets:102](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderQuickSearchPanel.ets:102) | #2F6373; stroke 3.5; 0 0 48 48 |
| reader_quick_back_theme_night | [ReaderAutoPageFullPanel.ets:248](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderAutoPageFullPanel.ets:248), [ReaderAutoPagePanel.ets:114](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderAutoPagePanel.ets:114), [ReaderControlSearchContent.ets:421](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlSearchContent.ets:421), [ReaderQuickSearchPanel.ets:102](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderQuickSearchPanel.ets:102) | #D2BD96; stroke 3.5; 0 0 48 48 |
| reader_replace_close | [ReaderReplaceQuickPanel.ets:110](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderReplaceQuickPanel.ets:110) | #2F6373; stroke 3.5; 0 0 48 48 |
| reader_replace_close_theme_night | [ReaderReplaceQuickPanel.ets:110](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderReplaceQuickPanel.ets:110) | #D2BD96; stroke 3.5; 0 0 48 48 |
| reader_session_pause | [ReaderSessionCapsule.ets:87](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderSessionCapsule.ets:87) | #FFFAF4; stroke fill-path; 0 0 8 8 |
| reader_session_pause_theme_night | [ReaderSessionCapsule.ets:87](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderSessionCapsule.ets:87) | #1C1A18; stroke fill-path; 0 0 8 8 |
| reader_session_play | [ReaderSessionCapsule.ets:88](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderSessionCapsule.ets:88) | #FFFAF4; stroke fill-path; 0 0 8 8 |
| reader_session_play_theme_night | [ReaderSessionCapsule.ets:88](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderSessionCapsule.ets:88) | #1C1A18; stroke fill-path; 0 0 8 8 |
| reader_settings_header | [MangaReadingSurface.ets:2196](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2196), [ReaderSettingsFullPanel.ets:113](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderSettingsFullPanel.ets:113) | #332C25; stroke 3.5; 0 0 48 48 |
| reader_settings_header_theme_night | [MangaReadingSurface.ets:2196](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2196), [ReaderSettingsFullPanel.ets:113](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderSettingsFullPanel.ets:113) | #EADFCE; stroke 3.5; 0 0 48 48 |
| reader_tts_clock | [ReaderTtsFullPanel.ets:358](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsFullPanel.ets:358), [ReaderTtsModulePanel.ets:221](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsModulePanel.ets:221) | #2F6373; stroke 3.5; 0 0 48 48 |
| reader_tts_clock_theme_night | [ReaderTtsFullPanel.ets:358](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsFullPanel.ets:358), [ReaderTtsModulePanel.ets:221](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsModulePanel.ets:221) | #D2BD96; stroke 3.5; 0 0 48 48 |
| reader_tts_header | [ReaderTtsFullPanel.ets:163](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsFullPanel.ets:163) | #332C25; stroke 3.5; 0 0 48 48 |
| reader_tts_header_theme_night | [ReaderTtsFullPanel.ets:163](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsFullPanel.ets:163) | #EADFCE; stroke 3.5; 0 0 48 48 |
| reader_tts_headphones | [ReaderSessionCapsule.ets:44](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderSessionCapsule.ets:44), [ReaderTtsModulePanel.ets:97](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsModulePanel.ets:97) | #2F6373; stroke 3.5; 0 0 48 48 |
| reader_tts_headphones_theme_night | [ReaderSessionCapsule.ets:43](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderSessionCapsule.ets:43), [ReaderTtsModulePanel.ets:97](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsModulePanel.ets:97) | #D2BD96; stroke 3.5; 0 0 48 48 |
| reader_tts_next | [ReaderTtsModulePanel.ets:203](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsModulePanel.ets:203) | #332C25; stroke 3.5; 0 0 48 48 |
| reader_tts_next_theme_night | [ReaderTtsModulePanel.ets:203](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsModulePanel.ets:203) | #EADFCE; stroke 3.5; 0 0 48 48 |
| reader_tts_online_engine | [ReaderTtsFullPanel.ets:575](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsFullPanel.ets:575) | #756F69; stroke 1.16667; 0 0 16 16 |
| reader_tts_online_engine_theme_night | [ReaderTtsFullPanel.ets:575](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsFullPanel.ets:575) | #BAAD9C; stroke 1.16667; 0 0 16 16 |
| reader_tts_play | [ReaderTtsFullPanel.ets:278](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsFullPanel.ets:278), [ReaderTtsModulePanel.ets:156](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsModulePanel.ets:156) | #FFFAF4; stroke 3.5; 0 0 48 48 |
| reader_tts_play_theme_night | [ReaderTtsFullPanel.ets:278](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsFullPanel.ets:278), [ReaderTtsModulePanel.ets:156](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsModulePanel.ets:156) | #1C1A18; stroke 3.5; 0 0 48 48 |
| reader_tts_previous | [ReaderTtsModulePanel.ets:134](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsModulePanel.ets:134) | #332C25; stroke 3.5; 0 0 48 48 |
| reader_tts_previous_theme_night | [ReaderTtsModulePanel.ets:134](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsModulePanel.ets:134) | #EADFCE; stroke 3.5; 0 0 48 48 |
| reader_tts_rate | [ReaderTtsModulePanel.ets:270](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsModulePanel.ets:270) | #2F6373; stroke 3.5; 0 0 48 48 |
| reader_tts_rate_theme_night | [ReaderTtsModulePanel.ets:270](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsModulePanel.ets:270) | #D2BD96; stroke 3.5; 0 0 48 48 |
| reader_tts_speed_thumb | [ReaderTtsModulePanel.ets:318](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsModulePanel.ets:318) | #FFFAF4, #2F6373; stroke fill-path; 0 0 18 18 |
| reader_tts_speed_thumb_theme_night | [ReaderTtsModulePanel.ets:318](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsModulePanel.ets:318) | #1C1A18, #D2BD96; stroke fill-path; 0 0 18 18 |
| reader_tts_stop | [ReaderTtsFullPanel.ets:281](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsFullPanel.ets:281), [ReaderTtsModulePanel.ets:185](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsModulePanel.ets:185) | #FFFAF4; stroke 3.5; 0 0 48 48 |
| reader_tts_stop_theme_night | [ReaderTtsFullPanel.ets:281](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsFullPanel.ets:281), [ReaderTtsModulePanel.ets:185](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsModulePanel.ets:185) | #1C1A18; stroke 3.5; 0 0 48 48 |
| reader_tts_system_engine | [ReaderTtsFullPanel.ets:579](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsFullPanel.ets:579) | #1F3528; stroke 1.16667; 0 0 16 16 |
| reader_tts_system_engine_theme_night | [ReaderTtsFullPanel.ets:579](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsFullPanel.ets:579) | #D2BD96; stroke 1.16667; 0 0 16 16 |
| reading_paper_phone | [ReaderPaperBackground.ets:49](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderPaperBackground.ets:49) | 非SVG或未匹配该扩展 |
| reading_paper_phone_highlight | [ReaderPaperBackground.ets:54](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderPaperBackground.ets:54) | 无显式HEX; stroke fill-path; 0 0 388.89 842.88 |
| reading_paper_phone_shade | [ReaderPaperBackground.ets:58](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderPaperBackground.ets:58) | 无显式HEX; stroke fill-path; 0 0 388.89 842.88 |
| reading_paper_tablet | [ReaderPaperBackground.ets:49](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderPaperBackground.ets:49) | 非SVG或未匹配该扩展 |
| reading_paper_tablet_highlight | [ReaderPaperBackground.ets:53](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderPaperBackground.ets:53) | 无显式HEX; stroke fill-path; 0 0 758.89 958.89 |
| reading_paper_tablet_shade | [ReaderPaperBackground.ets:58](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderPaperBackground.ets:58) | 无显式HEX; stroke fill-path; 0 0 758.89 958.89 |
| search_back | [ReaderChapterLoadingState.ets:42](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderChapterLoadingState.ets:42) | #1F1B17; stroke 3.5; 0 0 48 48 |
| search_back_theme_night | [ReaderChapterLoadingState.ets:42](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderChapterLoadingState.ets:42) | #EADFCE; stroke 3.5; 0 0 48 48 |
| search_mag | [SourceSwitchWindow.ets:684](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/source/SourceSwitchWindow.ets:684) | #756F69; stroke 3.5; 0 0 48 48 |
| search_mag_theme_night | [SourceSwitchWindow.ets:684](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/source/SourceSwitchWindow.ets:684) | #BAAD9C; stroke 3.5; 0 0 48 48 |
| settings_gen_refresh | [SourceSwitchWindow.ets:716](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/source/SourceSwitchWindow.ets:716) | #2D4A3E; stroke 3.5; 0 0 48 48 |
| settings_gen_refresh_theme_night | [SourceSwitchWindow.ets:716](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/source/SourceSwitchWindow.ets:716) | #D2BD96; stroke 3.5; 0 0 48 48 |
| settings_row_about | [MangaReadingSurface.ets:2706](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2706) | #2D4A3E; stroke 3.5; 0 0 48 48 |
| settings_row_about_theme_night | [MangaReadingSurface.ets:2706](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets:2706) | #D2BD96; stroke 3.5; 0 0 48 48 |
| source_switch_close | [SourceSwitchProgress.ets:85](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/source/SourceSwitchProgress.ets:85), [SourceSwitchWindow.ets:635](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/source/SourceSwitchWindow.ets:635) | #332C25; stroke 3.5; 0 0 48 48 |
| source_switch_close_theme_night | [SourceSwitchProgress.ets:85](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/source/SourceSwitchProgress.ets:85), [SourceSwitchWindow.ets:635](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/source/SourceSwitchWindow.ets:635) | #EADFCE; stroke 3.5; 0 0 48 48 |
