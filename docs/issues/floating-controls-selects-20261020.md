# 悬浮表面与下拉选择显示问题（2026-10-20）

## 本次范围与证据

- 源码基线：HarmonyOS Host `codex/message-ui-unification-20261019`，提交 `8a832882` 加当前工作树。既有文档、门禁和工具链 dirty WIP 保留。
- 触发：用户报告下载管理底部栏周围存在超出轮廓的可见空白，以及浮栏轮廓与正文边缘难以区分；随后报告筛选字段短值截断/空白过大、长书源菜单过宽。
- 用户确认的结果来自交互 Demo `reader-controls-preview.html`。本记录分开列出源码定位、生产实现和未取得的原生证据，不把 Demo 的浏览器结果当作 ArkUI 验收。
- 本次共享控件实现不改变选项集合、顺序、业务命令、提交/关闭身份、重复提交准入或章节多选。

## 悬浮栏问题定位与调整规则

下载管理书籍 List、章节 List 原来直接以 `padding(top: contentTop(), bottom: contentBottom())` 预留浮栏，默认上方约 78vp、底部至少 130vp。这会缩小固定列表内容视口，并在滚动过程中保留整条空白带；它不是底栏纸面扩张。ArkUI [List 绘制源码](https://github.com/openharmony/arkui_ace_engine/blob/master/frameworks/core/components_ng/pattern/list/list_paint_method.cpp#L42-L60)明确从内容尺寸扣除 padding 并设置内容裁切。

公共 `ReaderPageScaffold` 的透明全屏 footer/overlay 宿主本身不能作为全屏遮挡证据：它们使用透明背景和 `HitTestMode.Transparent`。圆角纸面、阴影、命中区域与滚动避让必须分别判断。

用户确认的 Demo 比例：正文左右 18；顶部外框左右 8、内部水平 padding 9、边框 1，使栏内起点与正文对齐；底部轻量栏左右 30；展开阅读控制面板左右 12；书架导航保留 196 的紧凑宽度。上述数值按页面现有有限规格落实，不能机械覆盖所有全宽底部面板。

| 页面/状态 | 源码定位与本次边界 |
| --- | --- |
| 下载管理：书籍列表、章节列表 | List 避让应转为 `contentStartOffset/contentEndOffset`；顶部和底部外框宽度分离。下载页面修改由对应页面 owner 集成。 |
| 下载管理：普通存储栏、管理选择栏 | 同一轻量底栏外框规则；保留实际内容高度测量和数据操作。 |
| 书架：内容/空态、主导航 | 顶栏与正文宽度分离；主导航已有独立紧凑限宽与裁切，不将其全屏透明父节点判作问题。 |
| 本地小说/漫画书籍详情 | 头栏、正文、操作栏分别判断；窄屏大字双动作不能靠持续压缩按钮解决。 |
| 漫画完整目录：当前章节底栏 | 固定底部表面与滚动内容避让分开；源码、原生像素与交互结论分别记录。 |
| 阅读控制：目录、外观、TTS、自动翻页 | 展开面板保留现有交互与宽度族；本次共享 Select 只处理其排版库选项的真实换行高度。 |
| 书源管理 | 分组字段与菜单列入下表；底部操作栏由对应页面 owner 集成。 |
| 设置、RSS/发现、普通管理页面 | 不能仅凭 `width('100%') + padding` 或存在透明宿主列为确定缺陷；原审计中多数滚动容器只有左右 padding。关闭的产品分支单列，不能当作当前可达页面验收。 |

本表是全量影响分类，不是各页面已在设备完成的清单；页面 owner 的最终差异和交付证据仍须合并记账。

## 共享选择控件实现

实现文件：`ReaderSelect.ets`、`ReaderSelectPanel.ets`、`ReaderInlineSelect.ets`、`ReaderChoiceRow.ets`，新增纯几何 `ReaderSelectGeometry.ts`；独立 TTS 选择族修改 `ReaderControlTtsContent.ets`、`ReaderTtsConfigOverlay.ets`。复用 ArkUI 原生文本度量、Text 换行、Scroll、bindPopup 和原有选择行规格，没有新增文字排版算法或另一套业务选择器。

1. 默认闭合按钮只测当前值；字号、字体、字重与渲染一致。总 chrome 为 42vp：左右 padding 20、文字到箭头间距 8、箭头 12、两侧边框 2。`controlWidth` 在 default 族表示可用宽上限，不强迫短值填满该宽度。外层 InlineSelect 也使用内容宽，避免内框缩短但布局仍占旧定宽。
2. 默认按钮最小高度 36，并根据原生当前文本字高增长；InlineSelect 接收真实触发器高度。fp 度量已由平台处理缩放，不额外乘一次 `systemFontScale`。
3. 菜单与触发器独立计算宽度。`menuKind: 'standard' | 'source'` 沿 InlineSelect 传递到 Panel；下载书源传 `source`。书源上限为 `min(264, floor(windowWidth * .74), safeAvailable)`，390vp 得 264、320vp 得 236。标准菜单受真实安全可用宽约束，短选项按内容收紧。
4. default、sourceGroup、排版库选项使用原生多行 Text；保留既有字体、颜色、选中图标和顺序。原生 `onAreaChange` 回报每行实际高度，面板按行高增长；长内容进入内部 Scroll，最大高度 330。回报捕获所属打开代次，旧代次和已关闭/卸载回报不能调整当前面板。
5. 现有 reduceMotion、closing、selectionId、generation、commit-before-collapse 和 finish-once 分支保留。新增行高不会提交业务选择。

## 全部公共选择消费者与保留依据

| 变体/页面 | 当前使用点 | 处理结果与依据 |
| --- | --- | --- |
| default：下载管理 | `SharedDownloadPage` 的快速选择、状态、来源、存储上限、清理天数、范围选书，共 6 处 InlineSelect | 共享控件自动获得当前值闭合宽、独立菜单和长项换行；来源通过 `menuKind:'source'` 使用紧凑上限。下载页面字段可用宽由页面 owner 对接。 |
| default：书源工具 | `SourceToolsPage.debugCard` 的“搜索/发现”“列表/详情/目录/正文”两处 | 短枚举使用当前值宽，不再被最长备选项撑宽；保留 busy 准入和原选择回调。 |
| default：目录规则 | `ReaderDirectoryRules` 的“已有标题/章首独立行/章尾独立行/独立行边界” | 同一共享改动传播；不修改层级规则数据或章节多选。极窄行里其他输入/删除按钮的总宽仍需本地原生检查。 |
| sourceGroup：书源管理 | `SourceManagementPage.groupFilter/groupOverlay` | 触发器保留结构化字段的剩余行宽和原外观，但原固定 15 高文字槽改为原生实测字高，外框 min36 随字高增长；菜单不继承字段定宽，独立测量、长组名换行、实际行高及水平安全边界。父级 `groupFilter` Row 和平板 `filterArea` Row 原固定 height36 同步改 minHeight36，避免新字高被旧父级压住；本分工未修改该页 footer。 |
| appearanceLibrary：当前阅读外观 | `ReaderControlPanel → ReaderControlAppearanceContent.selectField/selectOverlay`，缩进/简繁 | 闭合当前值紧凑宽和独立 104 菜单是既有批准外观，保留；修复选项被固定 25 高限制的问题，按原生行高增长。大字展开锚点的最终可见性仍属原生证据缺口。 |
| appearanceCompact：旧兼容面板 | `ReaderAppearanceFullPanel → ReaderAppearanceMotionStage` | 当前生产链使用上面的 ControlAppearanceContent，未挂旧兼容面板。本轮不改变其 52–56 定宽、固定定位及模板；其三字值截断风险保留为非生产兼容缺口，不冒充已修复。 |
| settingsPhone/settingsTablet | `SettingsPage.selectRow → SettingsSelectOverlay`：语言、启动页、动画 | 三类均被 `unimplementedSettings` scope 关闭。公共触发器仍修为当前值实测宽（含双边框的 chrome33/36）与 min34 的原生字高；手机底部 Sheet/平板 160 popover 是独立既有合同，本轮不迁移为 InlineSelect，也不更改其选项行固定高度；开启该产品范围前须复核窄屏和大字。 |

`ReaderChoiceRow` 的新增换行是显式输入。Settings 及旧兼容消费者默认仍走原单行/定位行，避免公共行组件无差别改变全部页面。

### 独立选择实现、原生入口与排除项

补查范围是 `entry/src/main/ets/**/*.ets`：以 `Select/TextPicker/TimePicker/DatePicker/Menu/MenuItem/ActionSheet` 调用、`bindMenu/bindPopup`、选择 builder/状态和下箭头资源交叉检索，再检查实际调用链；当前原生 `Select(...)` 为 0，以上原生 Picker/Menu/ActionSheet 与 `bindMenu` 调用也为 0。不能仅搜索 `ReaderSelect` 就宣称覆盖全部自绘选择器。

| 实现族 | 当前入口与源码事实 | 本次结果/排除依据 |
| --- | --- | --- |
| 当前生产 TTS：音色、引擎、语言、不可用处理 | `ReaderControlPanel.ttsModuleContent → ReaderControlTtsContent.ttsSelectValueField → configurationOverlay → ReaderTtsConfigOverlay`。音色由 detailSection 调用，系统引擎/语言由 systemSection 调用，不可用处理位于播放配置。共享 field 类型还含 session，但当前 builder 没有 session 入口，混音由现有 toggle 处理。 | 闭合值按实际字体/字重测量；原 `max(70,min(170,configWidth*.56))` 保留为 cap，短值不再填满 cap。音色 chrome61＝padding12＋标记24＋两处 gap12＋箭头12＋双0.5边框1，普通字段 chrome18；触发器按原生字高增长、父 Row min48/52。长闭合值保留原 cap 与单行省略，通过展开完整选择项阅读。 |
| 当前生产 TTS：展开配置与音色试听 | `ReaderTtsConfigOverlay.panelWidth/panelHeight/boundedContent/choiceRow` 原选项标题 maxLines2、说明 maxLines1，行固定54/44，面板按固定条数乘行高。 | 保留音色 `availableWidth−42`、普通260及原窗口上限；标题和说明原生完整折行，行高 min54/44、上下 padding10，Scroll 内容 Column 报告实际总高；固定条数预算仅首帧回报前回退。回报校验 mounted 与 selectionId，旧选择层不能改新层高度。保留试听/停止/提交/错误/管理回调；试听44×36改最小尺寸，让大字标签随内容增长。管理表单、按钮集合及复杂面板整体宽度未改。 |
| 旧 TTS 全面板 | `ReaderTtsFullPanel.selectorRow/ttsSelectValueField`，原70宽/36高单行省略 | 当前源码没有 `ReaderTtsFullPanel(...)` 组件调用，仅有类型导入；列为兼容实现，不列为本次当前生产修复。 |
| 旧 TTS 快速面板 | `ReaderTtsModulePanel.timerRow` 的86×30下箭头字段 | 当前源码没有组件调用；字段源码明确 `enabled(false)`，没有展开菜单。生产自动翻页/TTS 定时器是现有步进/预设交互，不是遗漏的原生 Picker。 |
| 书架分组 | `Index.shelfGroupBody → BookshelfGroupSelector` | 对话框内“默认”单选胶囊，正文按 padding 自然尺寸；不是闭合值打开下拉菜单，不迁移为新 Select。 |
| 书架/阅读更多、漫画下载 | `BookshelfMoreMenu/ReaderControlPanel → ReaderActionMenuSurface`；`ReaderMangaDownloadPopup → MangaDownloadOperationsPanel` | 命令菜单，没有“当前字段值→备选值”的选择合同。原图标、命令、有限宽高规格保留；动作菜单固定行高/单行大字可见性仍属其自身原生检查范围，不能由本轮 Select 修复推定通过。 |
| 漫画详情简介、漫画目录分支 | `LocalBookDetail.mangaIntro`、`MangaDirectoryEntryRow.branchToggle`、`ReaderDirectoryNavigationList` 下箭头 | 分别展开/收起正文或树分支，未弹出候选值；不归为下拉选择。 |
| 下载排序/章节范围与阅读设置分段 | `SharedDownloadPage.choiceRow`、`ReaderControlSettingsContent` 等 | 已直接展现的单选行或分段控件，没有额外闭合触发器；不机械套用 compact trigger 或独立菜单宽规则。下载页面与章节选择由页面 owner 按已确认 Demo 处理。 |

## 最小核对与结果

按 `GATE_INDEX.md` 的普通 UI 变更范围，仅选择以下本次局部核对，没有执行全量、HAP 构建、安装或设备操作：

| 核对 | 实际入口/嵌套 | 保护的具体风险 | 结果 |
| --- | --- | --- | --- |
| 四个 ETS 与纯 helper 的 SDK 语法/lowering | Node 内存脚本 → `installedEtsCompiler`、`createReaderBuilderProbe` 的完整组件声明、`pureModuleProbe`；仅本机 SDK 读取与编译器内存 API | 新 Builder 分支、属性和函数的 ArkTS 语法/组件 lowering 错误 | PASS；不是全项目语义类型检查或构建。 |
| 两个 TTS ETS 的 SDK 语法/lowering | Node 内存脚本 → `createReaderBuilderProbe` 完整组件声明；实际共享 child 源码注册、属性运行时及现有纯几何模块 | TTS 新度量方法、回报函数、原生换行属性和 Builder 语法/lowering 错误 | PASS；未执行原生布局或 TTS 服务。 |
| 纯选择几何 | 同一 Node 脚本直接调用新 helper，7 个明确输入；无子门禁 | 390/320 书源 cap、短值收紧、触发器上限、左右 safe、无效窗口 | PASS。 |
| 补丁格式 | `git diff --check --` 指定共享四个 ETS、TTS 两个 ETS、SourceManagementPage、helper 和本记录 | 本次补丁空白/冲突标记 | PASS。 |

局部脚本准备过程保留两次失败：首次错误地对 ETS struct 直接调用 `transpileModule`，SDK 报 visitor Debug Failure；第二次正确进入组件 lowering 但缺少 SDK 属性运行时端口，构造时报 `ObservedPropertySimplePU is not a constructor`。两者均为核对脚本用法错误，未计通过。改为项目现有完整组件 lowering 和 `createArkUIPropertyRuntimeProbe` 后，上述指定范围完成。

TTS 增补核对的第一次脚本缺少实际 `ReaderBoundedSurface/Header/Actions` child schema 注册，SDK 报这三处不符合 UI component syntax；没有将此脚本准备失败记为生产通过。按实际共享组件源码补注册后，两份完整 TTS 声明 SDK lowering 通过。未修改门禁 fixture，也未运行任何额外套件。

旧 `choice-live-admission` 与 `inline-filter` fixture 显式裁剪成员且没有新方法/metrics 端口，本轮未扩大维护它们，也没有执行或标记它们通过。它们不是本次动态多行几何的有效替代证据。

## 未决与验收边界

- 当前源码修改与 Demo 认可分开；没有新 HAP、安装回执、VM/真机截图或用户原生验收。
- 本轮内存 SDK lowering 不等于全项目语义类型检查。ArkUI 原生换行字形、行高回报时机、面板展开动画与 native popup 焦点/Back 仍待实际交付阶段检查。
- 应检查下载筛选短词完整、长书源分行、390/320 和大字、重新打开后的选择回显；也应检查滚动菜单末项可点、行高增长不裁切及收起不重复提交。
- sourceGroup 与排版库的自绘面板纵向锚点在大字/极矮窗口中的可见性仍须保留为未验证，不能由 pure width 数值核对推定通过。
- TTS 选项原生换行后，试听与勾选、末项可达、窗口变窄后回报更新、错误出现后 Scroll 高度和再次打开均需原生检查。既有复杂 TTS actor 的 detail frame270、内部 card340 与固定整体 contentHeight 存在旧高度合同不一致，本次没有扩大为复杂整框重排；不能把局部控件字高自适应写成整块 TTS 在任意字号都已验收。
- 页面级悬浮栏改动由各 owner 汇总，不能把本共享控件记录当作整个应用已完成的证据。

## 夜间明暗层级调整（2026-10-20）

用户在本轮明确授权“实现看看”，同时要求保留暖灰/灰绿色相，不能把整套界面改绿。本段实施基线为 UI `95366cd`、Host `33f7c7b2` 加已存在的 UI/工具链 dirty WIP。

代码侧已定位：default 选择器在下载筛选 Sheet 上的字段/菜单/选中填色合成后近乎同色；appearanceLibrary 选中填色与菜单均为夜间 `#2C2824`；sourceGroup 选中填色与菜单均为 `#2A2622`；TTS manager 字段与面板同为 `#2C2824`。浮导航共享表面色及作为边框的另一个表面色缺少稳定层级；书籍操作 Sheet 夜间底为 `#221F1C@98%`，与遮暗背景接近。LocalImport/TTS manager 的夜间遮罩错误地映射为 `#EADFCE@40%`，会提亮页面。

按已确定矩阵调整现有 App night 角色：普通卡片、浮面板、凹入字段、升高控件、阅读控制表面、TTS 内卡/字段/轨道及边线分别分层；下载专属 surface/soft/softGreen/muted/line 同步到既有灰绿族的相应层次。App day、完整8套正文主题对象、消息 family、主色/强调色与图标前景保持。没有改业务、选项、动效或页面布局。

default Select 新增专属 trigger/menu/selected 角色，MainTabBar 新增专属 floatingSurface/floatingBorder；新 day 逐项复制原消费角色的完整 RGBA。书籍 Sheet 使用新 `app.bookshelf.sheetSurface`，仅替换 `SheetSurfaceSpec.hostBackgroundRole`；不修改 `TOK_SS_WINDOW_BG`、`ActionSheetSurfaceSpec.groupRole`、换源抽屉/窗口。sourceGroup/appearanceLibrary/TTS manager 字段和两处遮罩只调整其已有角色 night。

本次必要核对清单先行登记如下；以下结果在实际执行后另记，不以计划代替通过：

| 精确入口与子调用 | 本次风险与不可省略依据 | 执行边界 |
| --- | --- | --- |
| `node tools/generate-theme-registry.mjs` 一次；读取 JSON、格式/RGBA校验、写 UI/Host 两份 Registry 与 Host Selection 复制文件 | 新 App role 必须生成可用 union 和实际取色表，防止 JSON 已改但生产仍用旧色 | 仅主题投影写入；无测试、构建、SDK 或设备子调用。 |
| 同生成器 `--check` | 核对三份实际生成投影与当前输入逐字一致 | 只读比较，不追加其他门禁。 |
| UI `node --test scripts/check-theme.test.mjs`：文件内3个命名测试 | 核对源哈希、全部 day/night RGBA 投影和8套正文主题投影；这些数据均在本次主题生成闭包内 | Node 自带 test/assert/crypto/fs；无子进程、构建或设备。 |
| Node 内存基线/矩阵/相邻合成 | 对比 UI `95366cd` 的既有 day、8主题、消息/主色/图标角色不变；核对批准 night 矩阵和新 day 复制；对真实相邻配对进行 Alpha 合成，检查选中底不再同色 | 基线仅 `git show` 只读；不把装饰性表面对比强行套3:1标准。 |
| Node 内存 SDK 声明 lowering 与实际角色路由 | 新 Select/Nav/Sheet 角色必须被真实选择器、导航与 Sheet spec 消费，不能只有新角色没有接线 | 只读已安装 SDK、现有 `createReaderBuilderProbe/pureModuleProbe`；有限组件/规格及其必要属性端口，无其他测试或 native layout。 |
| 指定本次文件的 `git diff --check` | 防止本次精确补丁空白/冲突标记错误 | 不扩大全工作树门禁，不处理他人的 dirty WIP。 |

本轮不构建、不签名、不安装、不操作 VM/设备；源码与本地局部核对不能代替原生夜间视觉验收。

实际完成：34个已有 App 角色只改批准的 night，另加6个专属角色。default trigger/menu/selected 为 `#3A342E/#332E29/#4B433B`；sourceGroup 与 appearanceLibrary 菜单/选中为 `#332E29/#4B433B`；浮导航面/边为 `#36322E/#62584B`，书籍 Sheet 为 `#36322E`，TTS manager 面板仍 `#2C2824`、字段 `#3A342E`。两处遮罩为黑40%。下载专属面/soft/softGreen/muted/line 为 `#30342D/#3F433C/#4A5647/#C8C6BB/#4E5349`，其 paper/ink/green/greenInk/danger 保留。

已执行结果：生成器写入一次及随后 `--check` 均通过，当前612个 App role×2及8套正文主题；UI主题3个测试全部通过。内存对比 `95366cd` 证明所有已有 day、完整 reader/app 对象、其余未选角色（包括消息、主色、强调与图标）不变，6个新增 day 完整复制原消费值。SDK 精确路由核对覆盖 default trigger/menu、三类选中行、浮导航的面与边、真实书籍 native Sheet options，day/night 均通过；只核对实际颜色消费，不声称布局或设备像素通过。

相邻色合成后的亮度比：default/sourceGroup/appearanceLibrary 选中与菜单均为1.385，TTS manager 字段与面板为1.191。数值用于描述同色问题已解除，不是把装饰性表面定义成3:1强制门槛。

本轮 SDK 脚本首轮遗漏 `ReaderChoiceRow` 的实际 child schema 注册，组件 lowering 因此失败；这是核对脚本准备错误，未记为生产通过。补入实际 childSources 后上述精确范围通过，没有修改 fixture 或扩大测试集合。Node报告的模块类型/类型剥离实验性提示保留为工具提示，不作构建或原生结论。

增补范围：最终复核确认共享分段仍使用旧近色，按用户已授权的明暗层级补 `app.ReaderSegmentedControl.SEG_BG` night=`#282420`、`SEG_SELECTED_BG` night=`#443C34`，均不透明；分段其余角色、全部 day 和逻辑不变。仅重做必要主题生成投影 `--check`，内存对本次修改前增量基线证明只有这两处 night 变化，并检查批准矩阵；SDK 仅加载实际 `ReaderSwitchSpecs/ReaderSegmentedControl` 核对选中/未选中取色。无需重跑此前已通过的 Select、导航、Sheet 或 UI 主题全文件核对；不涉及构建和设备。

分段增补结果：精确两角色增量/其余数据保留核对通过；生成一次后 `--check` 通过；实际 SDK 分段 Day→Night→Day 背景、选中底及未改文字角色路由通过。最终累计36个既有 night 角色调整、6个新增角色。canonical JSON SHA256 为 `6c3e9320a361de5e41e36da28d5a1b18d9a7c2ca6ad727e498b4128b87ca000d`。本次未重跑之前已通过的其他控件或主题测试。
