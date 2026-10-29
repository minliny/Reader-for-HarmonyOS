# 跨平台参考：样式、布局与动效

本页收敛已提交的通用 Reader 视觉与交互规则，供 iOS 等平台复用。
它不重新设计界面，也不将 HarmonyOS 专属增强变成其他平台的外观要求。

- Host 基准：`33f7c7b21474a76a042ebda911c5f0ff2d73cf54`。
- Reader-UI 基准：`95366cd93775ea0ad3ecbc0f60e8882717f93169`。
- 范围是上述已提交内容，不包含主目录未提交的浮栏、选择器或夜间层级优化。
- `0c37547c` 仅用于识别原生增强分支的历史分界，不是本交接包的取值版本。
- `codex/harmony-native-phase1-20261020` 的原生导航、材质及平台增强不纳入本页。
- 本页是参数与行为来源索引，不声明 iOS、浏览器或 HarmonyOS 视觉验收通过。

## 1. 来源优先级与读法

| 层级 | 使用方式 | 不承担的证明 |
| --- | --- | --- |
| 用户明确要求与本版适用的专项交互合同 | 约束输入、结果、取消、失败和生命周期 | 旧专项报告中的时点状态不是新验收结论 |
| 同版本已登记的领域视觉 JSON、字体和 SVG 来源表 | 提供可移植参数与原始资产身份 | JSON 内未消费字段不自动成为现行行为 |
| 本页固定版本的公共定义与生产消费者 | 补出具体几何、时序及实际消费关系 | 不等于设备绘制结果，也不能静默覆盖明确合同 |
| 已归档的 Figma、HTML 和原生截图 | 解释来源、对照已观察范围 | 不覆盖当前版本、全部状态或全部中间帧 |

字段冲突同时核对固定版本的实际消费者和明确合同；不能仅按文件名日期挑值，也不能将实现偏差直接确认为设计。
若仍无法判定，登记为 `REFERENCE_GAP`，保留冲突双方；不让移植实现自行选一个外观。
本页的 `REFERENCE_GAP` 是资料边界，不是另一份产品待办，也不授权修改现有行为。

[历史原生 baseline](../app-baseline/README.md) 保留 85 次捕获、64 个去重状态及 443 个私有文件哈希。
其截图和布局可作佐证；公共交接依赖下面的已提交参数与源码，不要求先恢复私有证据才能读懂规格。
[分类账](../app-baseline/CLASSIFICATION.md) 的 `existing-app` 只准入已观察属性，不能将整组件未观察属性一起升级。
[归档 LOGIC](../source-switch-reference/approved-source/LOGIC.md) 保存早期移植决定与样本；它不是当前全部数值的覆盖层。

## 2. 颜色与主题

App 颜色权威是 Reader-UI 基准提交的
[`theme/registry.json`](../../../../Reader-UI/theme/registry.json)。
Host 的 [ReaderThemeRegistry](../../../entry/src/main/ets/features/common/ReaderThemeRegistry.ts)
是生成投影，头部绑定 SHA-256：
`1a3ea68f162a2e440b60fa0dfe0001bc9c3051b6adba7700a60fdc73024a798f`。

以下只列用于核对版本的样本，完整角色使用 registry，不另建同值别名。
表内采用 Host `#AARRGGBB` 表达；转换到 CSS、UIColor 等格式时保留 alpha，不误读为 `#RRGGBBAA`。

| 角色 | 日间 | 夜间 | 语义 |
| --- | --- | --- | --- |
| `TOK_PAPER` | `#FFF8F4EC` | `#FF1C1E1A` | App 页面 |
| `TOK_CARD_BG` | `#E6FFFCF8` | `#FF282C25` | 卡片 |
| `TOK_SURFACE_PANEL` | `#9EFFFCF8` | `#9E2A2622` | 面板 |
| `TOK_FIELD_SURFACE` | `#D1FFF8EF` | `#D12C2824` | 字段 |
| `TOK_READ_ELEVATED` | `#BDFFFCF8` | `#BD2C2824` | 阅读控件浮起表面 |
| `TOK_MESSAGE_SURFACE` | `#FFFFFCF7` | `#FF2A3029` | 消息类别表面 |

上述夜间卡片是 `#282C25`，不采用未提交优化中的 `#30342D`。
漫画目录保留自己的领域色表，来自 Reader-UI
[`design/manga-directory/visual.json`](../../../../Reader-UI/design/manga-directory/visual.json)。
其生成投影 [MangaDirectoryVisual](../../../entry/src/main/ets/features/manga/MangaDirectoryVisual.ts)
绑定 `c4a5f2dda1598d4651e03e3af95acd8ba107ce769733bb4d3880e5ffde959be4`。
该版夜间 `surface=#282C25`、`soft=#30342D`、`active=#303C2D`、`muted=#ABA99F`。

App 日夜选择与阅读正文八套主题是不同维度；不能以 App 深色覆盖用户选定纸色。
[ReaderTokens](../../../entry/src/main/ets/features/common/ReaderTokens.ets) 的兼容颜色导出仅表示 day 默认。
活跃控件读取语义角色与当前 scheme；正文读取当前阅读 appearance。
高对比、未定义主题和额外系统材质没有在本页新增默认值。

## 3. 字体、图标和文字度量

完整字号、字重、行高、字距及缩放归属见
[ReaderTypography](../../../entry/src/main/ets/features/common/ReaderTypography.ets)。
`source` 区分 Figma 变量、节点、appBaseline、platformCalibration 和 runtimeAppearance；
移植时保留这种来源差别，不把平台校准值当成统一设计变量。

| 内容 | 本版规则 | 权威 |
| --- | --- | --- |
| 系统 UI 文本 | `scalePolicy=system`；字号与显式行高分别缩放 | ReaderTypography |
| 阅读正文 | `scalePolicy=readerAppearance`，由保存的字号、行距拥有 | ReaderTypography 与阅读 appearance |
| 未设行高 | 保留平台 AUTO 语义，不用 `fontSize × 1.5` 猜测 | ReaderTypography |
| 未设 family/weight | 保留继承语义，目标平台结果单独校准 | `ReaderInheritedTextStyle` |
| 消息标题 | 静态 600，17/24 | ReaderMessageStyle |
| 消息正文 | 静态 400，13/21 | ReaderMessageStyle |
| 消息动作 | 静态 500，13/20 | ReaderMessageStyle |
| 消息辅助信息 | 静态 400，12/18 | ReaderMessageStyle |
| 常驻通知标题 | 静态 400，14/22 | ReaderMessageStyle |

字体 family 与文件映射由
[ReaderFontFamilies](../../../entry/src/main/ets/features/common/ReaderFontFamilies.ts)、
[ReaderFonts](../../../entry/src/main/ets/features/common/ReaderFonts.ets) 管理。
消息角色见 [ReaderMessageStyle](../../../entry/src/main/ets/features/common/ReaderMessageStyle.ets)。
Noto Sans SC、Noto Serif SC、Inter 及可选阅读字体应连同其许可和既有文件身份移植。
不要用系统近似字体替换后仍声称精确还原；加载失败可以降级，但必须保留校准未通过状态。

漫画面板的静态 550/600/650 face 与固定标题 900 子集见
[字体来源表](../MANGA_SHEET_FONTS_PROVENANCE.json)。
900 子集只覆盖登记标题，不能用于动态书名、正文或新文案。
源文件有真实字重时使用对应物理 face，不依靠平台合成粗体。
换源使用同一组静态 Noto 400/500、Noto Serif Bold 与 Inter 400/500，见共同视觉 JSON 的 `fontAssets`。

图标使用 [SVG_PROVENANCE](../SVG_PROVENANCE.json) 中的语义映射、来源、许可和主题变体。
保持 viewBox 比例；不把描边图标替成填充图标，不依据相近名称另选系统符号。
业务选中/禁用/危险状态与图标外形分别读取；封面和漫画正文图片是内容，不归图标统一处理。
原生系统窗口和系统加载控件的图标/动画由平台适配承担，不伪造一份跨平台像素参数。

## 4. 页面、表面和自适应

页面公共框架由
[ReaderPageShell](../../../entry/src/main/ets/features/common/ReaderPageShell.ts)、
[ReaderPageScaffold](../../../entry/src/main/ets/features/common/ReaderPageScaffold.ets)
和 [页面框架说明](../../architecture/ui-page-framework-20261014.md) 共同定义。
`mainTab/settings/standard/detail/directory/search/selection/download/reader` 等类别保留显式变体；
不能将漫画目录、小说目录、详情目录和阅读内目录合并为一个样式。

- 系统/刘海顶安全区由窗口 owner 消费一次；页面只加本地已测量 header/tools/gap。
- 顶栏默认 58、书架初始 60 是首次布局 fallback；后续以真实 header 测量为准。
- 固定顶栏提供实色遮挡、裁切和层级；浮动顶栏保留其有限表面，不铺整页不透明背景。
- 固定底栏遮挡完整 lane，包括侧边和底安全区；浮动底栏只绘制自身卡片。
- 设置类普通页最大宽 720；管理/tools 等变体取当前规则，不全局强加 720。
- 横向可用宽度从当前容器与安全区计算；宽屏不能用设备型号代替实际窗口。
- 窗口、键盘、字体或方向改变只重算布局，不重复导入、删除、换源等业务动作。

公共表面有限变体以
[ReaderSurfaceSpecs](../../../entry/src/main/ets/features/common/ReaderSurfaceSpecs.ets) 为准。
下表是本版数据，不继承归档 LOGIC 的旧 JSON 导入 520 宽或默认分组 75% 宽。

| 表面 | 最大宽/边距 | 内边距/圆角 | 特别约束 |
| --- | --- | --- | --- |
| 换源与动作 drawer | 最大390；常规内缩20、窄宽16 | 内边距按对应内容规格；圆角22 | 业务与内容各归原 owner |
| 书籍移除 | 306/20 | 17/12 | cap；有边框/阴影；横排44高动作 |
| 下载确认 | 306/24 | 17/12 | cap；有边框、无阴影 |
| JSON导入、分组 | 360/16 | 17/12 | card-inset；键盘安全区；正文可增长 |
| 本地导入 | 350/16 | 17/12 | card-inset；任务/结果沿原 owner |

消息按 [消息框架规范](../../message-ui/FRAMEWORK.md) 分类。
普通短反馈、未决原操作、页面状态、确认与任务结果不共用一个万能弹窗。
普通短反馈默认 2000ms，同宿主同 key 在 2000ms 内去重；换源保留2200ms。
未决操作通知没有“超时即完成”；关闭提示不取消原业务。
系统 Toast/Alert 是这一基准已存在的平台适配边界，跨平台保留业务语义，不复制 Harmony 系统绘制。

公共 [ReaderPressFeedback](../../../entry/src/main/ets/features/common/ReaderPressFeedback.ets)
将 `TOK_ACCENT` 的 12% alpha 混合到原表面；松开、取消、禁用恢复原表面。
不额外加缩放、波纹或震动；领域已有按压变体按其登记，例如换源轻工具栏使用 green 的14%。

## 5. 领域布局规格

| 领域 | 公共资料 | 保留的规则 |
| --- | --- | --- |
| 换源抽屉 | [共同参考入口](../source-switch-reference/README.md) 与 [共同 JSON](../../../../Reader-UI/design/source-switch/source-switch.visual.json) | 390×844逻辑基准；最大宽390；实际内容宽<380为窄；可用高<560为短 |
| 换源大字/极短窗 | 同上 `policy` | 行高50×scale；书籍区至少100；极短窗让标题/书籍/列头/底部进入统一滚动流 |
| 漫画目录 | [visual.json](../../../../Reader-UI/design/manga-directory/visual.json) 与生成投影 | 普通行最小58；分组48；网格44；quick列表最大330；当前位置信息48 |
| 漫画宽屏/常驻目录 | [sheet记录](../../MANGA_SHEET_MOTION_20261003.md) 与实际 MangaReadingSurface | 手机底部、宽屏右侧、常驻左目录是不同宿主；不把右侧最大宽当整个阅读画布宽 |
| 下载/存储 | [visual-spec.json](../shared-download/visual-spec.json)、[fonts.json](../shared-download/fonts.json) | 保留原demo可追溯选择器与值；任务身份、排序和命令不由视觉JSON决定 |
| 阅读控制模块 | [ReaderControlGeometry](../../../entry/src/main/ets/features/reading/ReaderControlGeometry.ts) 及同目录各 `*Geometry` | 每个 actor 的源/目标/裁切/滚动锚分别计算，不整体缩放一张截图 |

换源示例查找/切换延迟是夹具，不进入应用。
换源字体、几何或曲线相同不表示真实请求、章节位置提交和错误恢复已验收。
其他页面的局部数字保留在各生产组件与公共角色中；本页不凭截图补齐未知数字。

## 6. 动效公共原则

共同输入是当前位置、目标位置、单调时间、同一操作/页面代次与 Reduce Motion。
[ReaderMotionClock](../../../entry/src/main/ets/features/common/ReaderMotionClock.ets)、
[MotionTimeline](../../../entry/src/main/ets/features/common/MotionTimeline.ts)、
[MotionPointTrack](../../../entry/src/main/ets/features/common/MotionPointTrack.ts) 给出当前采样方式。

- 小说控制栏等采用直接进度的路径在手指持有时直接驱动当前进度，不叠加第二条隐式追赶动画。漫画面板的拖动使用其既有弹簧请求，不能把前一规则推广到所有手势。
- 自动动画可从当前呈现姿态重抓、反向或接续，不回放初始帧。
- 退出中的可见内容保留到交接/完成；旧回调不得关闭新页面或重复提交动作。
- 帧更新只改变呈现，不发 Core 请求、写设置、重排全文或重新创建整页快照。
- Reduce Motion 收敛当前视觉生命周期，同时保留原业务计时、确认、取消及恢复语义。
- 开启减少动态效果后再关闭，不重播已经发生的动作。

## 7. 阅读控制栏：时序、进度与手势

当前时值来自 [ProductMotionTiming](../../../entry/src/main/ets/features/common/ProductMotionTiming.ts)：
唤出220ms、Quick→Full 320ms、Full→Quick 260ms、整体关闭200ms、恢复220ms。
这些是完整路径的名义时长；接续按剩余距离与当前速度缩短，不每次重跑全长。

[ReaderControlMotionPolicy](../../../entry/src/main/ets/features/reading/ReaderControlMotionPolicy.ts)
中，自动 morph 的进度为 `t²(3−2t)`。
手指持有样本绕过该缓动；释放延续使用初速度连续、末速度为零的三次多项式，
斜率夹在0..3。不能把 MotionSpec 中所有 cubic 条目都直接套到这一当前路径。

[ReaderControlGestureDriver](../../../entry/src/main/ets/features/reading/ReaderControlGestureDriver.ts)
与 [ReaderControlPanel](../../../entry/src/main/ets/features/reading/ReaderControlPanel.ets) 定义：

- Quick、Full、Hidden 抓手轴来自当前屏幕坐标；方向容差8；短按判据严格小于500ms。
- 最近有效移动方向选择释放目标；速度用于延续时间，不能改成统一“超过50%才展开”。
- Full向下先沿原轴回Quick，越过Quick才关闭；取消不等于点击或甩动。
- 自动运动中停指持有冻结当前帧；重抓保留当前源/目标、已花时间与屏外剩余位移。
- 失效pointer、过时代次、第二指及离页由原手势 owner 拒绝，不迁移为多个独立手势状态。

[ReaderControlMotionPresentation](../../../entry/src/main/ets/features/reading/ReaderControlMotionPresentation.ts)
保留整个轨迹的真实内容：中部透明度最低0.35、模糊最高2；
Quick清晰度主要在前20%变化，Full清晰度主要在后20%变化。
屏外Full内容按当前可见片段与Quick目标联合裁切，不能飞越其他设置内容。
背景、壳、导航、亮度条与内容各沿自己的几何轨道，不能替换为整个面板淡切。

## 8. 胶囊与页面运动

胶囊当前权威为
[ReaderSessionLaunchPresentation](../../../entry/src/main/ets/features/reading/ReaderSessionLaunchPresentation.ts)、
[曲线](../../../entry/src/main/ets/features/reading/ReaderSessionLaunchCurves.ets) 和
[专项合同§4](../../READER_REPAIR_SPEC.md)。
四入口为快捷自动、快捷TTS、完整自动播放区、完整TTS播放区，分别保留源尺寸和内容尺度。

| 阶段 | 时间 | 规则 |
| --- | --- | --- |
| 系统信息/控制壳交接 | 100–700ms | 信息入场、控制壳退场与源区域分开 |
| 源区域飞行与收束 | 200–1400ms | flight cubic(.4,0,.2,1)，收束到24×24；源内容等比缩放 |
| 清晰/模糊内容交接 | 600–1200ms内重叠 | sharp 700–1100淡出；blur 600/900/1200为0/.6/0，blur=3.5 |
| 源表面→canonical表面 | 1100–1400ms | 两个表面交接，pause圆点已可见 |
| 圆点保持 | 1400–1700ms | 24×24，右缘固定 |
| 向左展开/文字揭露 | 1700–2300ms | expand cubic(.2,0,0,1)；使用实测胶囊宽，自动最小96、TTS最小94；右缘固定 |
| 保持 | 2300–3500ms | 2300时可操作；不等尾部hold，也不重新挂载 |

失败、主动停止、中途唤出控制、后台、切书和 Reduce Motion 的落点按专项合同§4.3。
业务准备成功只更新真实状态，不重新播放morph；未确认音频不得显示为已播放。
旧actor在新owner ready前继续提供内容；晚到快照与成功回调不得复活已退役事务。

书架切换由 [MotionSpec](../../../entry/src/main/ets/features/common/MotionSpec.ets)
的1000ms轨道驱动：150ms提交布局，header 500–700、内容600–820；
封面移动420、缩放250、逐项错峰30，分别使用原曲线。
快速反向从当前采样值接续；不淡出整页代替分层运动。
字体排序：被拖项直接跟手，相邻项120ms换位，松手160ms落位；导入字体槽位保留。
下拉菜单：同一顶锚面板展开160ms cubic(.16,1,.3,1)，收起120ms cubic(.5,0,1,1)。
菜单动作只提交一次，视觉关闭完成回调不再提交业务。

翻页按 [ReaderPageSettlementTimeline](../../../entry/src/main/ets/features/reading/ReaderPageSettlementTimeline.ts)
保留当前位置：正常释放80..320ms，按距离与同向速度计算；已完成点击积压的rapid提示30ms。
位置曲线为 `1−(1−t)³`，小于0.01的距离为0时长。
这些仅适用于该呈现时钟；仿真翻页的 Native 轨迹不从此表推导。
书签下拉回弹登记为160ms EaseOut；其文案、图标与提交归原书签手势 owner。

## 9. 漫画 sheet、章末上拉与换源

[MangaReadingSurface](../../../entry/src/main/ets/features/manga/MangaReadingSurface.ets)
保留目录、阅读方式、设置、更多及目录行进入的本话下载操作面板；各自内容与动作准入归原 owner。
无章节 index 的“本书下载”面板是保留分支，没有当前正常可见入口；更多中的全书下载直接交原回调，管理进入下载管理页。
目录、阅读方式、设置和更多的字体路径保留原receipt准入。打开先清焦点/键盘；初始offset为snap上限+36，scrim为0。
本版实现通过首次布局后的 frame fence 请求进入：登记一次 `postFrameCallback`，由 `MangaSheetFrame` 的 `onIdle` 消费。
旧 [sheet专项记录](../../MANGA_SHEET_MOTION_20261003.md) 写的是两次frame；该表述与所选实现不一致，保留为 `REFERENCE_GAP`，不声称两者时序已经等价验收。
遮罩进出均160ms EaseInOut；sheet进入spring `(0,.9,500,43)`，退出 `(0,1.05,250,30)`。
退出保留标题、内容与实体身份，完成后撤销；期间阻断重复操作。
手机拉手只接受向下，拖动更新沿既有 `interpolatingSpring` 请求；距离严格大于96或向下速度大于550 vp/s关闭，否则回弹。
Reduce Motion跳过动画与frame等待，保留同一终态和导航提交边界。
各平台spring参数不能只按同名API逐项复制；速度继承与停止阈值未定义等价时记 `REFERENCE_GAP`。

章末上拉沿既有
[PullToRefresh适配](../../../entry/src/main/ets/features/manga/vendor/pulltorefresh/PullToRefresh.ets)：
仅向上越过章节底部、释放后下一章，未达阈值返回当前图片；当前未开放向下拉上一章。
触发距离为 `max(120,min(180,viewportHeight×0.2))`，保留上游五段阻尼；
回位动画180ms、Reduce Motion为0。内容/页码由真实章节事务提交，不靠拉动百分比伪造进度。
反馈是48高平面footer，显示继续上拉/松手进入/正在进入，不新增进度卡或重试按钮。
见 [边界交互合同](../../MANGA_BOUNDARY_TURN_UI_CONTRACT_20261008.md)。

换源抽屉当前进入320ms、退出280ms、结果行进入180ms，
使用共同JSON的 cubic(.2,.7,.2,1)；结果集合更新另有220ms EaseInOut。
生产消费见 [SourceSwitchWindow](../../../entry/src/main/ets/features/source/SourceSwitchWindow.ets)。
当前 [SourceSwitchSpinner](../../../entry/src/main/ets/features/source/SourceSwitchSpinner.ets)
使用平台 LoadingProgress；平台拥有环形几何和周期。
JSON保留的1000/1800ms spinner字段不作为当前自绘spinner要求，不能复活已替换路径。
减少动态效果或后台停止加载动画，但不取消查找/换源事务。

## 10. 历史值退出与明确资料边界

| 历史资料/字段 | 本版处理 |
| --- | --- |
| 9月9日胶囊480+120+240+160ms | 被当前四入口3500ms轨道替代；不能与其累加 |
| MotionSpec旧shell420/360及appearance分轨 | 文件头明确仅历史验证；不覆盖当前320/260的控制栏运行策略 |
| 归档全应用LOGIC中的旧弹窗尺寸 | 以本版ReaderSurfaceSpecs及实际消费者替代 |
| 历史整页截图中的颜色/字号 | 只作为对应日期已观察范围；当前参数由固定版本定义 |
| 原生增强分支与未提交主题/浮栏优化 | 不纳入本参考；未来采用需显式更新基准与差异 |

现有 `REFERENCE_GAP`：平台AUTO文字的实际行盒、系统窗口的具体像素、
跨平台spring速度/终止条件、仿真翻页Native与目标平台呈现的等价性、
所有动效中间帧/中断的成套可移植视觉样本。
这些缺口不抹掉已明确的参数、业务状态和交互规则，也不自动要求新设计。

移植应先以本版公开定义实现，再按同入口、同状态、同主题、同字体和相同窗口条件对照。
源码匹配、参考渲染、iOS运行、交互以及用户验收分别记录。
静态截图、构建成功和少数端点不替代连续动效或全状态验收。
