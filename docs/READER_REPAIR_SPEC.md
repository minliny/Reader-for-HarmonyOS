# Reader 修复实施规格

版本：2026-09-13 审计冻结稿。目的：约束下一轮实施，不代表本轮已实施或验收。

本文是专项实施合同，当前任务状态只维护于根 `DEVELOPMENT_BACKLOG.md` §11。下列“当前”均指本轮审计输入快照；实施后不在本文另开第二份待办。修改需求时先更新合同版本、来源及差异，再改实现和测试，不得由代码反向改写需求。

## 0. 授权、依据与证据边界

本轮授权是：完整定位、写方案、按内容提交已有修改。不是继续执行整个新方案。整理提交不改变原有生产文件字节；既有错误和半成品用 WIP 提交保存，禁止作为可交付候选。

审计起点：Harmony `50cad401ffc6d235f4ac388136ee5213b9b736ad` 加既有工作树；Core `e0e4b550bcffd3b959d7b90fa599c1df713f479e` 加既有工作树。整理后的精确提交见 `evidence/2026-09-13-current-gap-register/workspace-commit-receipt.json`。Reader-UI 和其他根层仓库/工作树单独核对，不把根目录初始化为新 Git 仓库，不搬移或删除历史工作树。

依据优先顺序：用户最新明确决定 → 本轮取得的 Figma/Make 设计与动效 → 当前源码事实 → 旧文档/记忆。旧助手的“已完成”“设计没定义”“待决定”都不是产品授权。互相矛盾的原始记录保留为证据，本文明确覆盖相应旧结论。

禁止继承以下错误口径：

- 320/260/200/220ms 属于控制栏，不是胶囊；胶囊有完整 3500ms Figma 轨道。
- 控制栏改为全不透明的旧规划已被撤回。应用配色归属改变，既有透明度/阴影/模糊/层级按现有实现和对应设计保留；单书操作弹窗的不透明要求单独有效。
- `ReaderControlThemeStyle` 忽略参数、Panel 未消费它，不等于主题模块已完成。
- 远程 TOC 已有缓存、同源身份与去重；旧 envelope/数组兼容问题已修，不能重复列为当前根因。
- 字体/分页/亮度/持久化不能只以正则匹配、构建通过或 HDC 返回成功证明真实效果。
- 原列表四行不允许借重新排版改变原有文字字号、字重和字体。
- 源码、本地测试、HAP、VM、真机、用户验收分六层，不能互相替代。本轮无新 HAP、安装或设备测试结论。

## 1. 原反馈完整映射

用户原编号重复了“8”，实际有 21 个独立条目。保留原编号，用 U01–U21 防止后续漏项。下表是审计快照，不是新建状态总账。

| 合同 ID / 用户原号 | 当前已有实现 | 尚需完成的具体内容 | 对应规格 |
|---|---|---|---|
| U01 / 1 | 收起/唤起会触发 window policy；已传阅读 ink | 多处误以 reader 激活当 control 可见；统一一开关与系统状态栏所有权 | §3 |
| U02 / 2 | sourceName 字段与 source.list 回填 | 移除 URL/sourceId 的显示回退；冷恢复、删源仍有可靠名称 | §5.1 |
| U03 / 3 | 主列表分作者/章节，并拆 source/progress | 多选列表仍拼字符串；窄屏固定宽度重叠；共用四行投影 | §5.1 |
| U04 / 4 | 检查更新移除系统 Button 最小高；图标切资源 | 筛选展开态的背景/轮廓/间距未对齐；区分筛选与整理 | §5.2 |
| U05 / 5 | 四入口、共享 sampler、快照/圆点/终态胶囊 | 启动等待、capture空档、换树、暂停键错组、文案延后、页码跳位、尺寸/旧测量 | §4 |
| U06 / 6 | 阅读8套基础纸色/文字色；应用固定Day tokens | 两套应用/八套阅读注册、角色、联动、迁移、持久/同步及所有消费者 | §2 |
| U07 / 7 | 两个旧设置字段和安全区计算存在 | 合并一个可见开关；状态栏与自绘顶部信息互斥/同高；不重复留白 | §3 |
| U08 / 8a | 完整面板已避让 topBar，按 viewport 限高 | 内部实际内容滚动、IME/短屏/横屏、所有模块统一预算和收起命中 | §3.3、§6 |
| U09 / 8b | More 已被接成当前页书签切换 | 此接法不是完整 More 定义；按 §5.3 的来源边界修复，不能称已完成 | §5.3 |
| U10 / 9 | 单行成功/失败图标；结果 Scroll；按数量缩高 | 摘要仍固定警告图标；刷新SVG/裁剪；真实行高、短屏、按钮尺寸 | §7 |
| U11 / 10 | 中央区域已可点；picker 在 importing 前 | 防双开；取消返回；离页后旧 bool 回写；资源和事务生命周期 | §7 |
| U12 / 11 | 导入三个静态状态树 | 进行、成功反馈、结果交接动效；不能假进度或仅旋转一张静态图当全部完成 | §7.4 |
| U13 / 12 | 顶More四路由；工具栏已接完整管理页 | 恢复已定轻量分组选栏；菜单样式图与业务决定分离，书架设置进入实际设置区 | §5.2 |
| U14 / 13 | 搜索历史有收起、独立尾行按钮 | 按实际宽度填满折叠区域；固定操作槽；长词/旋转/字体缩放 | §8.1 |
| U15 / 14 | 清理 lrm/rlm、全角分号及部分方向字符 | 用既有通用实体解析能力，统一各入口；安全保留正常文本和身份 | §8.2 |
| U16 / 15 | loading/results 共用一个原生 loader 容器 | 全搜索生命周期保持 actor 与屏幕位置；按参考动效，不以系统默认代替设计 | §8.3 |
| U17 / 16 | version/identity校验、TOC非空检查及diagnostic字段 | 已复现 bookUrl 缺失；错误分类/变量/卷标题/分页/诊断消费 | §9 |
| U18 / 17 | 书架命中传 shelfSnapshot、缓存快路径、singleflight | 旧 acquisition 绕缓存；catch-all；删源离线读；持久事实优先 | §9 |
| U19 / 18 | 正文32/44.44vp与共享layout；新增profile参数 | Math.max仍锁32，24不生效；单事实宽度与重排位置保护 | §3.4 |
| U20 / 19 | 自动亮度状态/无障碍文案；1/.72透明度差 | 正确显示自动/手动状态与原生失败回滚，遵循设计选中态 | §10 |
| U21 / 20 | MOVE实时预览、16ms节流回调 | lookup代次淘汰会饿死所有中途写；单在途+latest pending、末值flush | §10 |

追加范围不得遗忘：旧快捷设置标题/边框/圆角、TTS副文案/0.50x、自动翻页无返回/速度/播放框、收起按钮、书架永久模式、原翻页14项和12类性能证据、Make/TTS七组；分别并入 §5/6/10/11。

## 2. 主题架构与颜色约束

### 2.1 一处定义，两个作用域

建立一个跨平台主题定义注册表，建议放 `Reader-UI` 的设计配置目录；平台只保留颜色格式、窗口、资源与响应式尺寸适配。Core 保存选择配置和同步合同，不负责把 ArkUI/SwiftUI/Android 绘制对象写入备份。

定义包含：`schemaVersion, themeId, scope(app|reader), scheme(day|night), displayNameKey, order, roles, effects, provenance`。ID 稳定，不以展示名/数组位置为身份。角色必须有完整类型，缺值构建失败；不得隐式回退 Day 色块。渐变、纹理、阴影、透明度、状态色和图标着色均在表内，不能仅集中背景色。

| 作用域 | 消费位置 |
|---|---|
| AppPalette，固定Day/Night两套 | 书架/搜索/导入/设置/详情/目录/换源/控制栏全部模块、TTS、自动翻页、播放胶囊及应用弹层 |
| ReaderPalette，初始8套且可扩展 | 正文纸色/纹理/文字、阅读顶部及底部信息、状态栏/导航栏、正文选区/高亮/搜索命中、仿真纸张正反面和翻页阴影 |

“跟随应用主题”不等于同一色值涂满所有控制模块。现有TTS与通用控制栏的主色/次级色差别保留为App角色。应用表面换色时保留当前alpha合成层次；不能从某个子层62%直接声称最终画面38%透正文。先列实际父子表面、motion opacity、mask、blur的合成关系，再做同主题对照。

### 2.2 已存在的8套阅读基础色必须原样迁入

来源：`ReaderAppearanceRenderStyle.ts`。选择器swatch不是正文paper。

| ID | scheme | paperStart → paperEnd | ink | 纹理/光照 |
|---|---|---|---|---|
| day | day | #FFFFFF → #FFFFFF | #2B241D | 无/无 |
| warm | day | #FFF6E9 → #FFF6E9 | #2C241D | 无/无 |
| paper | day | #FBF4E9 → #EFE2D0 | #2B241D | 有/有 |
| green | day | #EEF5E8 → #EEF5E8 | #263423 | 无/无 |
| night | night | #26231F → #26231F | #E9DECE | 无/无 |
| warmNight | night | #27231F → #27231F | #E7D8C8 | 无/无 |
| paperNight | night | #302B26 → #211F1C | #E9DECE | 有/无 |
| greenNight | night | #202B26 → #202B26 | #D8E2D2 | 无/无 |

新安装默认日/夜阅读主题分别为排序中的第一个 `day/night`；迁移已有有效 active/default ID 必须保留，不把当前 `paper/paperNight` 默认配置粗暴清空。用户修改默认项以前已选中该主题，因此“设为默认”只写当前theme对应scheme的默认ID，不额外跳另一主题。不能将夜主题设为默认日主题。

阅读角色补齐规则：status background 对齐纸色顶部实际端点，status foreground 精确使用 ink（无额外 alpha）；顶部信息使用阅读palette的专属meta角色，迁入现有 `#766C61/#C8C0B4` 并记录对应scheme，不能误改为App色。正文高亮/标记/选区和纸背/阴影从现有消费者提取成独立角色，保留已有状态和强度，不通过主题ID的字符串包含night来散落判断。

### 2.3 App颜色完整性门禁

当前生产 `ReaderTokens.ets` 主要是Day，不能说已经存在完整Night。必须把App运行角色逐项列全：paper、surfaceSolid、card、cardHi、panel、panelSoft、elevated、field、mask、ink、muted、controlInk、icon、primary、onPrimary、accent、success、warning、danger、line/lineStrong、divider、selected/pressed/disabled、shadow，以及TTS/目录/换源局部角色。

已确认必须保留的Day举例：paper `#F8F4EC`；solid `#FFFCF8`；card `#E6FFFCF8`；panel `#9EFFFCF8`；panelSoft `#A3EEE6DB`；ink `#1F1B17`；muted `#756F69`；primary `#2D4A3E`；onPrimary `#FFFAF4`；control ink `#332C25`；control primary `#2F6373`。`#AARRGGBB`与平台RGBA转换只能在适配器完成一次。

本轮现场枚举证明Figma `Reader · App Color`（245:3）确有Day245:1与Night254:0，88项均有双模式值，37项不同、51项相同。**“Figma没有Night”旧结论作废；生产未接Night和设计未定义Night是两回事。** 完整88项和变量ID/解析值见[配色证据](../evidence/2026-09-13-current-gap-register/theme-figma-app-colors-audit.md)，这是本合同组成部分。

可直接复用的Night：runtime paper `#24211E`、bright `#2C2824`、paperSolid `#1C1A18`、surface `#E52A2622`、ink `#EADFCE`、muted `#BAAD9C`、border `#33E2D1B9`、primary `#D2BD96`、primaryDark `#7A684F`、accent `#D69B5F`；另27项书架/设置/书源/换源专用Night逐项原样迁入。注意：Figma原始8位为RRGGBBAA，本段已换成ArkUI AARRGGBB；注册表采用明确RGBA字段，适配器转换一次。

Night补齐的完整候选（**本方案推导，尚未回写/确认Figma**）如下；保留每个实际消费层原alpha，用已有Night基色，不从零制定新色系：

| 角色 | Night候选（AARRGGBB） | 规则 |
|---|---|---|
| panel / panelSoft | #9E2A2622 / #A32C2824 | Night surface/bright + 原alpha |
| elevated / field / disabled | #C72C2824 / #C72C2824 / #C22C2824 | bright + 原alpha |
| surfaceSolid / translucent | #EB2A2622 / #6B2A2622 | surface RGB + 原alpha；solid名称不意味着强改FF |
| select top / bottom / card | #FF2C2824 / #FF24211E / #FF2A2622 | 保留渐变与卡片层级 |
| line / strong / hard | #2EE2D1B9 / #57E2D1B9 / #66E2D1B9 | 已有Night border RGB + 各层原alpha |
| primarySoft / bg / strong / border | #17D2BD96 / #1FD2BD96 / #47D2BD96 / #6BD2BD96 | primary派生，不用Day绿染Night |
| selectChevron | #FFBAAD9C | Night muted |
| selectTrigger / selectedPhone / selectedTablet | #0FD2BD96 / #0ED2BD96 / #0FD2BD96 | 原状态alpha |

10个浅色surface候选用于补齐明确残留；11个line/primary/select候选须逐组合对照；7个同值语义常量先沿用。不能把所有51个同值都判错。当前onPrimary浅色与Night primary亮色组合需要单独检查：建议Night通用App实心动作底用primaryDark、强调文字/描边用primary，通用onPrimary继续当前浅色；控制/TTS亮色主按钮另用深色onControlPrimary，不能套同一前景角色；若原组件实际用法不同，以该组件合成样张登记，不能默认浅字配浅底。完整消费者映射表是本合同组成部分：[theme-control-role-mapping.md](../evidence/2026-09-13-current-gap-register/theme-control-role-mapping.md)。它逐项覆盖TOK_READ、18项TOK_TTS、7个controlTheme字段、共享表面、动态渐变和所列裸色，分别给Day实际值、Night候选RGB与原alpha，不能只拿88个Figma变量清单当完成。

尤其拆分TOK_TTS_PAPER：容器surface候选#FF2A2622、亮主色上的onPrimary候选#FF1C1A18、slider/switch thumb候选#FFEADFCE；TOK_READ_BODY_INK正文和目录消费者也拆Reader/App角色。FigmaE5与当前E6量化差别保留各自来源，不在迁移中偷偷修改Day。Night控制局部主色保持独立键，即使候选RGB暂相同也不合并掉未来扩展角色。

现有App surface与Night专用source-switch等alpha若不同，以冻结的对应模式值为依据；用户“按现有实现来”所保留的是透明效果和层级，不允许未经记录统一抹成opaque。单书75%菜单的实色要求独立优先，使用对应Night surface RGB的FF host底。

实现结构、联动和持久化不依赖这些候选的视觉确认，可先做；全量视觉验收必须等待所有角色有来源/候选和样张，不能把复制Day写成已完整支持Night。

### 2.4 联动状态机：只处理一次用户意图

持久配置为 `appThemeMode(day|night|system), readerThemeId, defaultDayReaderThemeId, defaultNightReaderThemeId`。`systemScheme/effectiveAppScheme` 是运行时派生值，不进备份。单个 reducer/事务产生新快照，一次发布给各平台消费者，带origin防派生事件回流。

| 事件 | 必须得到的结果 |
|---|---|
| 设置页手动选Day/Night | app改固定模式；reader切对应默认主题 |
| 设置页选跟随系统 | appMode=system；按当时系统scheme切对应默认reader |
| system变化且appMode=system | 两作用域按新scheme原子更新，reader切对应默认 |
| system变化且appMode固定 | 不改变用户配置 |
| 阅读选任意与当前effectiveApp同scheme主题 | reader保留该具体ID；appMode原样保留，尤其不能取消system |
| 阅读选相反scheme主题 | reader保留用户明确选的ID；app改对应固定模式并取消system；不得被第二次“app改变”事件重置成默认reader |
| 当前阅读主题设默认 | 只更新它所属scheme的default ID，active ID不变 |
| 同步恢复 | 一个事务校验/迁移全部选择；冲突由用户手动选择，不按时钟自动覆盖 |

备份结构固定为 `themeSelection: { version:1, appMode, reader:{ id, scheme }, defaultDayReaderId, defaultNightReaderId }`。这仍是四项逻辑选择，reader.scheme只是所选ID的明暗分类元数据，default分类由字段名表达；不携带RGB、纹理文件、平台渲染结果或主题定义。运行时四字段快照与此envelope单点编码/解码，不维护两套配置事实。

未知ID回退到备份reader.scheme对应的有效默认主题；默认无效用内置day/night。已知ID以registry真实scheme校验，拒绝伪造分类。旧四字段备份先用历史ID迁移表求scheme；旧未知ID依次使用备份固定appMode、当时解析的systemScheme、当前effectiveApp，并记录具体回退原因，不按名称猜。网络失败不能重置本机选择。

### 2.5 迁移与验证

迁移保持字体、字号、阅读模式、进度、书签、WebDAV地址/凭据不变。配置写入由一个串行owner处理，快照带changeId；失败仅回滚仍为当前意图的整份快照，旧T1失败不能覆盖新T2。禁止出现App已夜间而reader仍旧值的半状态。启动先恢复选择再挂首屏，迟到读取不能覆盖本次显式选择。平台订阅解绑、配置changeId去重、同scheme事件幂等。

每个事件运行真值表；覆盖system Day/Night、8主题、2默认、未知/已删除ID、失败写入、跨平台恢复。逐角色静态检查禁止生产页面新增裸色/二次palette；旧token仅过渡，消费者迁完后删除失效分支。视觉矩阵覆盖2App×8Reader的合法/中间切换组合，胶囊App色与页码Reader色分别核对。

## 3. 状态栏、安全区、完整控制栏与正文边距

### 3.1 一个开关与三种画面

产品只显示一个“拓展到刘海”开关，不再并列“隐藏状态栏”。值关闭：阅读保留系统状态栏区域，背景是阅读纸色、图标文字是阅读ink，自绘顶部信息在其下；值开启：纯阅读隐藏系统状态栏，自绘顶部信息放在原状态栏高度的顶部区域。无论开关如何，唤起控制栏时系统状态栏都显示，顶部控制栏在其下，自绘重叠顶部信息隐藏。退出控制栏按开关恢复；退出阅读恢复应用chrome。

旧字段迁移必须在normalize补默认值之前读取原始record。当前V4只有整体schema version，没有字段mtime；默认hideStatusBar=true、extendIntoCutout=false，不能臆造“最后编辑项”。确定迁移表：

| 原始记录 | 新单开关 |
|---|---|
| 已有新schema合法单开关 | 原样保留 |
| 旧V1–V4明确存在boolean extendIntoCutout（无论hide值） | 用该extend值；false就是关闭，true就是开启 |
| extend字段缺失，V3/V4存在合法hideStatusBar | 按同义值迁入 |
| extend缺失，只有V1/V2 hide或字段损坏/无配置 | 用新默认false；旧版本hide默认不能当显式选择 |

因此常见V4 true/false组合迁为false，遵循保留当前“拓展到刘海”开关位置并修正状态栏行为的明确规则，不作为需要用户逐条处理的冲突。迁移原子保存新schema并保留其他设置；写失败不消费迁移标记。只显示/落盘一个统一语义，旧字段仅用于一次兼容读取。

### 3.2 唯一窗口所有者

`ReaderWindowCoordinator` 接收 `{ownerGeneration, readerActive, controlsPresented, extendIntoCutout, readerPalette, appPalette, metricsRevision}`。所有启动、偏好修改、失败回滚、前后台、控制收起/重开、离页路径均调用同一policy推导，不允许一部分调用传 `windowChromeActive` 冒充 `controlsPresented`。

`controlsPresented`生命周期固定如下：opening从有效唤起意图开始为true；quick/full稳定态为true；普通closing直到顶部控制actor退出并完成owner交接前仍true；胶囊启动0–700ms顶部控制退场段仍true，700ms顶部退场确认后false；snapshot/capture完成不决定它。打开子模块不改变它，已退出阅读则由应用owner接管。系统API晚回执按ownerGeneration拒绝，不能让逻辑hideControl当帧抢先隐状态栏。

在系统状态栏仍显示的阶段，自绘信息中与其重叠的**顶部子区域**保持遮挡；底部信息/页码仍执行胶囊Figma100–500ms轨道。700ms系统栏归还阅读时，同一metrics样本显示顶部信息的当时采样值。这是用户最新系统栏规则对顶部重叠区的明确适配，不隐瞒成原稿全部像素不变。

顶部条高度取真实系统status区域（px转vp）并保留隐藏前的有效测量；隐藏导致系统inset=0时不能把自绘顶栏高度也归零。cutout只决定内容禁入区域，不能把整块刘海面积重复加为顶部高度。若横屏/分屏确无顶部status条，使用当前方向有效metrics，不复用竖屏高度。

状态栏色使用paper顶部采样端点和ink。白纸主题的字色是 `#2B241D`，按阅读主题对齐，不是无条件纯黑。当前曾有 `#99000000` 的透明黑造成发淡；精确ink写入已有代码，但仍需实机API实际着色证据。平台如只接受黑白tone须报告能力差异，不能声称成功设置任意ink。

旧generation的窗口Promise不能覆盖新owner。切换系统栏和阅读布局使用同一metrics快照，避免一帧双重padding；只有排版预算实际改变才重排。顶部信息/正文/控制栏三者不能各自再补一份状态栏高度。

### 3.3 控制栏自适应

沿用当前topBar实际高度54vp、safeTop外间距10vp、bar与fullPanel间距8vp。`topBarTop=max(authoredTop, safeTop+10)`；`panelTop=max(authoredPanelTop, topBarTop+54+8)`；`availableHeight=max(0, viewportHeight-panelTop-max(bottomSafe,20)-keyboardOcclusion)`。键盘仅扣实际相交区域，不重复扣系统resize已减少的viewport。

模块最终高度=min(对应Figma内容高度, availableHeight)。Header/拖拽柄/关闭与必要底部操作保持可达，内部body独立Scroll。文字行高按真实字体；禁止整体等比压缩字号/命中区来塞满屏幕。屏幕极矮时缩减装饰空白、保留固定操作高度并滚动内容，必要时让整个sheet可滚而顶栏仍有独立退出入口；不能负高度/覆盖顶部bar。

完整TTS配置弹窗采用header+scrollBody+fixedFooter，IME打开后保存/取消可见。四个主模块与子弹层共用预算，不能只给设置页加maxHeight。旋转/键盘/安全区变更按revision原子rebasing，当前动画进度和可见位置连续，不重放展开。

### 3.4 正文宽度：历史与本方案新建议必须分开

历史Harmony基准：手机左右32vp，大屏44.44vp；390vp屏幕实际正文326vp。不是应用页面352vp内容列。当前新profile被 `max(profile.contentHorizontal, configuredHorizontal, safeHorizontal)` 钳住，所以传24仍为32；对应测试还在要求该错误限制。

沿用当前实际断点：有效viewport W<600vp为compact，W≥600vp为expanded，优先实际尺寸而非设备型号/旧hint。显式用户inset配置（若存在）优先auto profile；auto才使用以下默认。旧硬编码32不是用户配置，不能作为下限再次max。

本方案建议新手机默认：`base=clamp(16,24*W/390,28)`；实际左右边距均为 `max(base, safeLeft, safeRight)`。320→19.69，360→22.15，390→24，430→26.46vp；正文分别约280.62/315.70/342/377.08vp。大屏先保留44.44vp基准，超宽正文最大720vp并居中：`textWidth=min(W-2*max(44.44,safeLeft,safeRight),720)`。720在此是本方案阅读列新上限建议，不援引书架720作为历史阅读决定。

这组数值是针对用户要求“合理自适应方案”的具体建议，尚不伪装成既有Figma决定。结构修复先消除旧硬下限/重复padding，再由一份profile同时供隐藏测量、屏幕正文、仿真纹理、滑动/覆盖槽位、连续阅读、选区/高亮坐标使用。不能测量342而显示326。

宽度改变用Core语义章/字符锚保位置；禁止用旧页号直接恢复。layoutSignature必须包含inset与viewport revision；图片宽度/缩进/行高只算一次。验收覆盖长行、全角/emoji、段落缩进、图片、字体倍率和《绍宋》第34章6/11页44%历史位置，正文无丢字/重复/裁剪。几何数值样张属于视觉确认点，不影响根因已定位。

## 4. 胶囊：四入口完整轨道与呈现事务

### 4.1 本轮现场设计来源

Figma文件 `klhs2jMM4MncaJFqZMfqEK`。快捷自动C `1307:3126` / source `1308:3236` 286×196；快捷TTS D `1353:3288` / source `1353:3304` 286×190；完整自动E `1392:4012` / playback source `1392:4862` 316.675×104.384；完整TTS F `1392:5024` / playback source `1392:5053` 312×128。完整design/motion原始返回保存 `capsule-figma-live.json`，不是对旧截图的推测。

固定12个产品actor为：ImmersiveInfo incoming、PageLabel incoming、TopBar outgoing、DockShell/FullPanel outgoing、TriggerMorphProxy稳定父容器、MorphSurface canonical shell、SourceRegion true-scale background、sharp content、blurred content、CapsuleContent reveal clip、CapsuleTransitionContent persistent leading、CircleState Pause。四场景完整原名称/ID在上述控制角色附录§1；C的Review title/timing/rule三个说明文字不进入产品。sharp和blur分别采样translate+scale+opacity，SourceRegion与canonical surface独立，不能只实现scale/opacity而漏位移。

四场景duration均3500ms。应用每次有效启动只播一次；审视页面的loop不搬到产品。2300ms动作已到终态，之后是hold，不能再要求用户等尾部hold才能控制播放。

| actor/阶段 | 原始时间 | 实施值与行为 |
|---|---|---|
| 顶控制栏、Dock/FullPanel退场 | 100–700ms | 顶部上移，其余外壳下移；源播放区独立持有 |
| 沉浸信息出现 | 100–500ms | opacity 0→1 |
| 源区域飞行/收束 | 200–1400ms | 对应入口宽高→24×24，飞向最终右缘；bezier(.4,0,.2,1) |
| 源内容scale | 200–1400ms | quick 1→.084；full auto 1→.076；full TTS 1→.077 |
| sharp内容 | 700–1100ms | opacity 1→0，ease-in |
| blur副本 | 600/900/1200ms | opacity 0/.6/0；独立曲线，源blur为3.5px，不替换成固定12 |
| sourceSurface→canonicalSurface | 1100–1400ms | 两个surface独立1→0与0→1 |
| pauseCircle首次出现 | 1100–1400ms | 与canonical surface同轴0→1，圆点hold时已可见 |
| 圆点hold | 1400–1700ms | 24×24，固定右缘 |
| shell向左展开 | 1700–2300ms | 自动24→96，TTS24→94；bezier(.2,0,0,1)，右缘不动 |
| leadingIcon+label | 1700–2300ms | 1700ms step-end显现；clip内x=-72/-70→0，与展开同时结束 |
| pauseCircle展开位移 | 1700–2300ms | 相对shell x=4→76/74；屏幕右缘不动，不随文字从左飞入 |
| 右下页码 | 100–1400、1400–1700、1700–2300ms | 先让圆点、停留、再随展开左移；C偏移101.45→72→0，D101.452→72→2，E101→72→0，F99→70→0 |
| 最终hold | 2300–3500ms | 原actor保持，不换树、不重播 |

静态自动胶囊96×24、TTS94×24，padding6、gap4、暂停圆钮16×16。响应式只映射实际源/目标坐标及平台单位，不能拉伸文字或把四入口用一个快照尺寸代替。所有未在简表列出的property以原始轨道为准；归档时保留hash，禁止人工抄表丢曲线。

### 4.2 已确诊偏差及对应改法

1. `startTtsSession`等待`start→whenStarted`才morph，自动翻页也等待TTS停止屏障才动。把**视觉启动**移到有效点击当帧：创建呈现事务、接管source、启动轴；业务仍异步准备/互斥，状态为preparing，不能假报playing。成功只更新业务投影，不重播；失败撤销本事务并给可操作错误状态。
2. `beginSessionCapsuleMorph`先hideControl再await snapshot，capture阶段又不渲染胶囊，产生空档。真实source必须保持挂载直到新owner接管；优先直接用稳定组件source actor。快照只能用已校验revision的预备副本，或作为不阻断源显示的异步替代。失败不能先删源、再直跳终态掩盖。
3. 当前flight Image、dot Row、expand Capsule、staticShell轮换。改为固定Stage与固定actor集合，phase只控制交互/诊断，不能决定树是否创建。结束保留同一shell在终态，释放仅供飞行的缓存资源。
4. 当前pause键和leading文字同Row并共用offset。拆sourceSharp、sourceBlur、sourceSurface、canonicalSurface、revealClip、leadingIconLabel、pauseCircle及footer actor；逐轨道采样。
5. 当前480+120+240+160再加revealOverlap是人为近似。删除启发式重叠，直接编译/采样3500ms设计keyframes；不私自“加速”或把控制栏320ms借给胶囊。
6. 页码当前只收sessionVisible与最终宽度，展开时整段跳位。页码必须接收同一个PresentationSample，并执行自己的两段轨道。不能让正文分页/纹理为页码每帧重建。
7. 启动时从隐藏投影反推sessionType可能把TTS当auto，产生96→94二次调整。事务显式携带type/sourceKind/目标rect，不能fallback错误类型。
8. source measurement必须校验lifecycle、book、moduleVisit、viewport、scroll、layout/theme/font revision；失效测量不得用于飞旧位置。迟到snapshot必须release，不能hide新页面。

### 4.3 状态、并发、取消、性能合同

`SessionLaunchPresentation`最少包含：generation/lifecycle/bookIdentity/moduleVisit、type/sourceKind、sourceRect/targetRect/layoutRevision、paletteRevision、monotonic startTime、businessStatus、cancelReason。每个时刻只生成一次不可变sample，所有actor读取同一sample。

点击的第一时间是当帧接管源/按压和准备态反馈并启动轴，**不是第一帧就在右下显示完整胶囊**；保留设计开头100/200ms的轨道保持，不额外等音频或快照。控制壳退场由胶囊事务轨道驱动，不能再并行跑普通hide动画形成第二时钟。

暂停/恢复只更新当前圆钮/文字和业务状态，不重启飞行；停止、离页、后台、切书、source/module改动失效旧generation。自动/TTS业务互斥保留停止屏障，stop失败不得启动另一业务。重复点击同意图幂等；启动中重新唤起控制栏按当前姿态交还owner，不能无条件跳终点。没有用户拖拽胶囊的需求，不借此新增能力。

异常/中断落点按下表固定为本方案实现合同，不能用“跳终态”四字代替：

| 事件 | 业务与呈现落点 |
|---|---|
| preparing时点已出现的pause | 接受desiredPlaying=false；准备可继续，但真正发声/开始自动计时前检查此意图，进入readyPaused；恢复点击再启动业务。不得先播一句再补pause，文案只在ACK后称已暂停，不重播morph |
| TTS↔自动的stop屏障失败 | 不启动目标业务，保留原业务真实状态；撤销目标启动事务，从当前姿态交回原source模块，显示可重试错误，不把原业务伪造已停止 |
| 启动失败/权限拒绝 | 保留错误事实，失效本次业务；恢复触发时的quick/full模块和scroll锚。原control模型一直保留，按当前几何rebasing接管，再沿现有控制打开轨道恢复；飞行actor在新source ready后走现有capsule exit淡出，不先清空/不跳到完整胶囊 |
| 启动中主动stop | desiredPlaying=false并阻止未开始业务；从当前视觉姿态走现有exit淡出，页码从当前偏移回静态无胶囊端点；不强制完成未走完的向左展开。late success不能复活 |
| 中途唤起控制 | 冻结本次sample并把源模块/壳/输入交给控制Runtime；使用当前screen rect和现有layout rebase继续打开，不重放启动。系统栏按§3先显示；保留实际playing/paused状态 |
| 后台/离页/切书 | 停止视觉帧并失效所有snapshot回调；按业务后台配置决定是否继续TTS，不能仅因停动画杀掉允许后台的朗读。返回同业务用静态终态，不重播入场；已停止则无胶囊 |
| 途中开启Reduce Motion | 立即取消视觉轨道，投影当前业务静态终态；不等待3500ms，不停止业务。关闭Reduce Motion不重播已经发生的启动 |

恢复路径统一交接原则：在新owner确认ready前旧actor仍提供可见内容；按source revision保证只有一份交互owner。恢复时可以执行既有exit/控制打开动效，但不能私自改变成功路径3500ms keyframes。此表新增的是失败/打断实现规则，不冒充Figma包含了所有错误场景。

每帧禁止Core请求/设置写入/全文测量/新PixelMap/分页cache失效。快照数量和像素预算受目标区域约束，创建/释放平衡；frame callback统一失效。Reduced motion直接显示静态结果与真实业务状态，不保留飞行/ghost。

### 4.4 关闭门禁

四入口分别取0、100、200、500、600、700、900、1100、1200、1400、1700、2300、3500ms及各点±1ms；比对rect/opacity/scale/blur/clip/右缘/页码。1700ms壳、leading和页码第二段同时起动；2300ms全部到位；pause在圆点阶段可见。每帧只一份source owner，无空白/重影，动画终态与静态layout一致。

注入TTS准备0/100/1000ms、失败、旧success、snapshot延迟/拒绝/尺寸0/旧revision、重复点、停止再启动、换页/旋转/字体变化。检查数据互斥、资源释放与首帧可见反馈。旧测试中“等待TTS成功才morph”“capture不显示接管actor”“morph/static两个builder”必须替换成真实状态转移与sampler测试，不改成另一组只验字符串的断言。

代码根因已明，先改代码和本地；之后同manifest VM录制四入口及中断逐帧对照。真实触控/呈现耗时若仍无法由代码/VM解释，再按授权和代码优先原则最小真机取证。

## 5. 书架：展示、四种入口与本机配置

### 5.1 列表和批量管理

统一 `ShelfBookPresentation` 供普通列表与批量列表消费；不得复制两份排版。四行：书名；作者；最新章节；来源+进度。标题/作者/章节/来源原有字体、字重、字号、行高、颜色角色保持，变的是行的组织。最新章节取最新元数据，缺失用明确缺省文案，不能把当前阅读章节冒充最新。

sourceName优先使用当前书源注册名称，再用书架保留的最后有效显示名；书源已删除时用“书源已移除”等明确短文案，绝不显示URL/sourceId或统称“网络书”。本地导入用本地来源语义。读书源名不触发每本书远程搜索；批量加载一次、revision缓存、不可变更新，不覆盖title/author/lastChapter/进度等Core字段。

第四行用同一信息区域的稳定三段网格：左段source（单行省略）、中段progress（中心对齐）、右段与左段对称的保留空间；不能一条字符串居中，也不能因source过长挤偏progress。窄屏按真实宽度分配，source可截断，不缩小字号。普通和批量两模式沿用同组、同排序、同筛选后的identity集合，新增勾选控件不能重新按另一套字段排序。

### 5.2 四类入口不混用

| 入口 | 已有决定/证据 | 实施约束 |
|---|---|---|
| 顶栏竖三点More | 独立锚定弹窗样式图，Figma4572:1796；不是单书操作弹窗 | 采用一体尖角、圆角、描边/阴影及紧凑动作行；菜单内容必须按下文收口，不能把图标三个点推导成三个动作 |
| “我的书架”右侧工具栏 | 已定宫格、列表、筛选、整理四动作，只有顶栏搜索 | 图标visual20、外框34、命中44按原节点；列表整理资源bookshelf_settings源271:472，不是More菜单settings源4575:24 |
| 工具栏整理 | 原用户明确第一版仅默认分组、轻量单选栏，不去独立管理页 | 恢复选择栏；只显示默认，选中后筛该组；禁止暴露Core已有CRUD/统计/实体ID。保留历史数据，禁止把已有自定义分组重写成默认 |
| 单本更多/长按 | 用户明确不透明、约75%屏宽 | host实色+正确card/border/radius/shadow；宽度=.75×可用viewport并安全区钳制；原内容等比例适配其容器但保留文字和命中底线，不影响顶More176vp样式 |

补齐同一原始分组决定中的两个入口：书籍详情在书源行下显示“分组：默认”；长按单书增加“编辑分组”，复用同一个默认单选栏。它们不打开CRUD页、不新增第二套分组数据，也不破坏历史非默认分组归属。

筛选图标的问题是点击后的呈现：展开/收起/有筛选条件/无条件分别按参考的背景、轮廓、色和图标态；不能以换实心图标作答。筛选行保留检查更新的独立动作属性，不能把更新当分组选项。按钮按原文字行高+内边距测量，现有12/18与上下6为30vp视觉高度，扩大命中区域不能扩大可见按钮。

本方案对顶More内容的具体收口建议：保留“批量管理／本地导入／书架设置”，移除重复“分组管理”项，由工具栏整理唯一承担轻量分组。三行与style-only图数量相同只是结果，不能反称该图早已确认业务内容。书架设置打开真实书架/搜索设置分区，至少复用已存在的自动检查更新、书架显示方式配置；设置主页面“书架与搜索设置”的当前空回调也接同一路由，返回恢复原书架列表/筛选/滚动。不能仅跳通用Settings首页就称闭环，也不新增不相干的Core管理能力。

这部分明确区分：轻量整理定义已确认；顶More菜单最终动作与书架设置分区内容属于本方案收口提案，历史尚未查到用户对业务名单的明确确认。实现前确认此具体差异即可，不能把所有菜单/已有样式重新提问。

### 5.3 阅读顶栏More

当前Figma933:59只给34×42命中框/20图标的正常actor；本轮已有代码把它接到toggleCurrentPageBookmark。这不构成“更多”功能完成，更不能据注释推导用户已定。

本方案提供可审阅的最小功能提案：More弹出阅读操作菜单，复用已有书籍信息、添加/移除当前页书签、进入该书目录三个真实动作；在线书另列换源，离线本地不显示；任何动作继续走已有Core/Host身份和busy门禁，关闭回原控制态，不静默切源。弹出样式复用当前应用popover体系、随App主题，正文/状态栏仍Reader主题。若历史最终定义被追回，以实际用户决定替换此名单并记录差异，不以当前bookmark toggle维持一个语义错误的“更多”。本项动作名单与样式扩展明确列为提案，不能未经确认发布。

### 5.4 永久本机配置与WebDAV

用户要求：书架模式作为WebDAV本机配置的一部分，未手动修改或恢复默认就永久保留。当前Preferences与Asset并行保存会竞态：已用真实方法复现list→cover后Preferences=cover、Asset=list，读取又优先Asset，可能重启反转。

改为**非秘密本机配置单事实源**（Preferences/既有本机配置域），Asset只承载凭据；一次迁移仅在Preferences模式键不存在时读取旧Asset模式；本地键已存在即为权威，不被旧Asset覆盖。旧Asset原始字段缺失时，不能把load()补出的cover当有效用户选择；本机模式值和迁移标记一起提交。记录迁移版本后不再用旧Asset覆盖它。未配置WebDAV也能持久保留模式，不能为保存模式伪造凭据。

序列化整个本机配置读改写和flush，变化带revision；快速切换只提交最新有效值，失败UI保留最近确认状态并可重试。WebDAV保存/删除凭据不得重置模式；只有显式恢复默认重置cover。启动hydrate先于首屏，await后重验ability/lifecycle，迟到hydrate不覆盖本次手动切换。

WebDAV配置备份中保留该非秘密选择，恢复遵循用户明确选择的配置集合；凭据走既有秘密存储边界。主题仅传选择状态，不能把主题配色定义塞入本机备份。旧数据、未配WebDAV、连续反向切换、写失败、重启、恢复默认、保存/删除凭据和恢复备份分别验。

## 6. 快捷/完整控制内容与旧视觉反馈

实施文件：ReaderControlPanel、ReaderControlSettingsContent/Geometry/OptionModifier、ReaderControlAutoPageContent/PlaybackGeometry、ReaderControlTtsContent/TtsStyle、ReaderTtsConfigOverlay；布局和输入统一走现有Runtime，不另建通用动效引擎。

- 设置标题：当前quick标题与选项已改几何，但需要按真实字形高度确保标题lane、子标题lane、选项bar不重叠；compact/full及每个中间p都校验。标题不截字；lineHeight不足不能靠负translate掩盖。父clip覆盖圆角外沿但不裁掉描边。
- 选项和外框：保留原圆角6/8、bar/card边框和alpha；稳定态、中间态、选中/禁用态分别核对。AttributeModifier保留原生差分，不能为补边框让每帧重复下发所有静态字体/事件属性。
- 自动翻页：快捷内部不再渲染返回按钮；速度标题/值/滑轨/±各有独立bbox且同progress插值，不混用full坐标；播放控制框和圆角保持。速度以同一秒值供快捷/完整/业务，变更无重复启动。
- TTS：播放副文案常驻两行明确空间，不能用110vp临时扩宽就认为所有状态可读；长状态省略/可访问文案不挤压播放命中区。0.50x在最左，五预设等分原间距，总宽受容器约束；Core为整数50–200，展示倍速和后台值可逆转换。
- 收起：shell纯视觉HitTestMode.None，header在正确z层，收起有稳定hit target；一次点击只发一次collapse，拖动释放不能重复点击。快捷/完整/动画再抓/键盘开启/子弹层关闭的意图不能串。
- 固定角色与动态角色分开：位置/大小/blur/opacity随progress，字体/事件/不变边框只在必要时更新。不能为了性能擅删设计blur、文字或alpha，也不能用整块截图替代可操作控制内容。

TTS功能保留已经实现的五字段（名称、URL、API key、发音人、MP3/WAV/PCM）、跟随高亮/来电暂停/后台/常亮/混音、章末定时与配置持久。当前独立音色试听仍缺：增加受限试听事务，使用当前候选配置和固定短试听文本，不入书籍进度、不冒充正式朗读；停止/换音色/离页取消旧事务，失败不覆盖原正式引擎。保留试听音频/正式播放互斥策略和权限回执。

在线引擎编辑/删除/激活入口不得在重做五字段表单时丢失。密钥留空保留，显式清除另有动作；失败留草稿，Core配置/Host secret/当前引擎选择整体回滚。真实系统与HTTP引擎、GET/POST、三格式、后台/来电/耳机/网络中断分别验。当前波形属于Make装饰样式，不虚构为音量计。

## 7. 导入入口、结果与动效

### 7.1 一次导入一个owner

保留当前已拆好的选择与导入网关。状态为idle/fileSelection → pickerOpening → importing → settling → result，另有cancelled/failed；`importAttemptId + navigationGeneration + runtimeGeneration` 三者共同校验。pickerOpening即防重；中央区域和底部导入按钮共用同一意图。保留书架More→导入选择页的既有入口层级；用户点击中央“从系统文件中选择”或页内导入文件按钮时立即进系统picker，不先闪出“正在导入”。不借修picker时序未经确认跳过设计中的选择页。

每次await后重新读当前route和generation，不缓存isStillOnBookshelf跨await。当前已复现：导入中离页后，旧bool仍导致applyBookshelfState与result写入。入库已成功就保留Core数据并失效旧书架读取；只有同一页面同一attempt才更新弹窗。旧失败/取消/成功不能重开弹窗或覆盖新导入。

同路由内关闭导入弹窗、重新打开选择页也立即撤销旧importAttemptId，不能只清展示状态；route/navigationGeneration未变不代表旧任务仍有呈现权。已提交的Core导入继续按真实结果落盘，展示撤销与业务取消分别处理。

picker取消回原画面，不显示完成结果、不制造失败书名。文件访问权限/临时副本只活到任务需要的期限，关闭/失败清理未使用资源；不能为修复UI撤销已提交成功的书籍。少量文件瞬时完成也先有明确操作反馈，不为演示动效强制延迟解析/持久化。

### 7.2 结果事实和图标

列表每行从Core真实结果投影成功、失败、恢复待确认，保留具体失败原因。摘要从整个batch推导全成功/混合/全失败/待确认；全成功使用成功资源和相应App角色，不能无条件红色感叹号。计数必须与逐行结果相等；防重复触发不能把Core合法的“已存在/幂等复用成功”改成失败。展示区分新增成功、已存在/复用、失败、待确认，以实际Core结果映射；用户取消不伪造成功，未新增书籍不能冒充新增数量。

当前行右侧已有success/failure分支；真正错误之一是摘要固定import_summary。import_refresh资源内已有transform/clip，UI又旋转-113.93°；按对应Figma节点重新导出干净SVG/viewBox及完整stroke，不用放大容器掩盖裁剪，也不把两次旋转继续叠加。

### 7.3 hug内容、超出滚动、固定操作

设计来源2657:917；现场metadata确认Footer2657:905为350×76，Button2657:906在x16/y16、318×40。导出代码的`flex-[201_0_0]`是grow权重，**不是201vp固定宽度**。恢复 `buttonWidth=panelWidth-32`，40高、原字体/圆角20；两侧16，保持完整图标和文字。此项是恢复设计，不是新增fullwidth提案。

外壳 `min(measuredContentHeight, safeViewportHeight - topGap - bottomGap)`。header/summary/footer固定；列表分配剩余高度，超出**滚动**（用户已定，不再问分页）。行高来自原生动态测量/列表布局，不能用count×61估计带两行错误的行；61仅作为原设计最小行高。单本hug实际一行而不占半屏，空批次不生成伪行；长批次可滚到最后，完成按钮不随列表滚走。

极矮窗口中，若header+summary+footer已超过可用高度，则header/summary并入滚动内容，只固定完成操作；所有剩余高度钳制非负。完成操作必须可达，不能为坚持固定三块让按钮越界。

约束：零/单/双/7/50项、长中文名、错误两行、字体放大、窄/宽/横屏、IME、safeArea，尺寸重算不能闪回固定636/410。边框与内滚动clip独立，不能切右侧图标。

### 7.4 动效合同

业务和呈现分开：进行态只表达等待，不伪造百分比；停止转动和成功/失败反馈由真实batch决定。halo、track、arc、状态图标、文案、外壳和结果内容各有owner，不能只把三张SVG放一起算“动效已接”。spinner转弧线，文案不转；完成后从同一shell交接到结果，不先卸载产生空白。

本轮现场设计原始返回见`import-search-motion-raw/`及其报告。该导入树本轮未返回motion轨道；搜索Make源码也不包含导入，故本方案明确提出以下候选，不冒称Figma已有这些时值：32×32 arc绕(16,16)以1000ms linear连续转，halo/track固定；真实结束时保留当前angle，0–120ms进行内容淡出，0–220ms同shell从228高变到实测result高度，80–220ms结果内容淡入，曲线bezier(.2,0,0,1)。完成标记由真实摘要状态同时出现，不新增庆祝或勾线轨道。直接瞬时成功可进result，不人为等一圈。必须覆盖瞬时完成、失败、取消、后台、旧attempt、Reduced motion。过渡时间不得套用胶囊或控制栏时长。

## 8. 搜索历史、简介与加载

### 8.1 历史布局

保留已有展开/收起和viewState，修复硬取4项。按可用宽度、实际字体、chip内边距/gap计算折叠两行（两行作为本方案布局收口），在能完整放入chip的前提下填充；长词单chip省略，不按字数猜宽、不切半个chip。

更多/收起放同一操作槽、同一右边锚点，不跟着最后chip漂移。若全量可放入折叠区域则不显示无意义操作；展开保留全部历史并允许所在页面滚动，收起恢复历史区域稳定锚点，不丢输入/键盘/查询。宽度/字体变更重新测量，不修改历史数据顺序或去重身份。

### 8.2 简介清理

当前BookIntroText新增lrm/rlm/全角分号只解决一类残留。通用HTML/entity解码复用已锁定的开源解析能力，Core输出展示plainText或在已有标准解码边界统一处理；不再维护不断扩大的实体手写表。Reader薄适配仅负责已观察到的损坏分号归一、必要方向控制符清理、空白折叠和展示长度。

顺序明确：界定输入是HTML/纯文本 → 标准解析/实体解码 → 受限重复转义处理（有上限、达到稳定即停）→ 删除无展示意义控制符 → 空白规范 → 投影简介。不得全局替换用户书名/正文/URL/规则/源身份。测试`&lrm;`、`&lrm；`、`&amp;lrm;`、数字实体、正常&、emoji、段落分隔、已纯文本、合法语言方向；搜索、详情、书架同一展示逻辑，不以UI过滤反写源数据。

### 8.3 搜索加载连续性

当前共同Stack中的一个LoadingProgress是已有修复；但groupScopeRow插入会改变容器，文案和spinner都bottom48也有重叠风险。改为query generation持有的稳定加载组合，锚在整个搜索安全视口，spinner和文案作为有间距的组，loading→首批结果→流式结果不换节点/时钟。

新query重新开始，旧query晚结果不能驱动当前动画；停止/完成/失败结束并保持结果可操作。loader不阻挡点击，不因列表重排重建。已有Figma导出资源优先复用；系统默认LoadingProgress只有在轨道/形状一致时可用，否则按原actor实现，不把“原生”当自动等于设计。本轮已读取原始Make搜索源码及预览computed CSS：spinner是1000ms、linear、infinite、0→360°；13/36px两尺寸分别中心旋转。它现在是已取证参考，不是本方案猜值。演示1800ms搜索timer不可进入生产，源码没有专门结果crossfade，不能自行添加。准确出处见动效附表。

## 9. 远程目录与已入架复用

完整调用链、两组生产探针、输入hash及源码见`toc-current/REPORT.md`，实施不得略过其上下文和错误合同。

### 9.1 两个已复现根因

- Core `reader-runtime/src/remote.rs:toc_with_next`只写current_url，没有把BookTocParams.bookId送到context.book_url；reader-content默认book_url为空，user_variables又会删built-in bookUrl。完全同一HTML/身份，章节规则用bookUrl条件返回0章，只改成baseUrl条件即1章。正常依赖此上下文的书源被错误执行为空。
- `BookAcquisitionCoordinator.openBook`把持久目录资格绑到acquisition.sourceVersion/catalogAt/24小时。旧行缺字段时，已有非空持久目录却没有调用cache.book.status，直接detail→toc，远程空导致emptyToc。缓存快路径确实存在，错误在准入条件和覆盖入口。

### 9.2 上下文与目录语义

Core统一构造source/book/toc/chapter上下文：canonical book身份不随目录分页变，current/baseUrl随真实重定向/页变；built-in由Core写入，用户continuation变量只覆盖允许的业务字段。首目录/后续目录页/正文规则都检查bookUrl/book/chapter真实值，不给空对象冒充已支持。

沿用现有规则引擎、QuickJS、URL库、HTTP continuation、page budgets，禁止第二套TOC解析器。合同新增字段必须同步schema/Core/Host binding/fixtures。

区分卷标题/非跳转目录行和可读章节；保留顺序/identity，无URL卷标题可显示不可点，不因一行缺URL拒整本书。只有可读章节数0才是empty-readable-catalog。索引和进度引用由Core统一定义/迁移，禁止UI过滤后私自重编。空首页如有合法nextUrl继续有限分页，保留循环检测、总页数/耗时/请求预算；失败不发布部分目录覆盖旧完整目录。

### 9.3 缓存、刷新和失败

所有入口以Core持久事实判断同源同书，不以页面内存shelfBooks已加载为资格。已有非空有效目录先可读；缺/过期acquisition只触发元数据补齐/后台刷新，不剥夺缓存读取。旧规则变量不得混入新规则网络请求；已缓存正文不因规则更新失效而被删除。

删源/停源仍可读已有缓存；缺正文明确提示联网能力不可用，不能要求重加书源才能读本机内容。缓存miss/可重建派生损坏可受控同源获取；取消、identityMismatch、存储故障、sourceVersion变化必须保留类别，不用catch-all吞掉后重新联网。

在线空/HTTP错误/格式错/规则错不能覆盖旧非空TOC、章节、进度、书签。旧缓存仍可用时保留阅读并提示刷新失败；无缓存时保留详情、重试当前源、用户主动换源，不白屏、不静默同名换源。后台刷新不清visible TOC/滚动位置，不能在阅读中被旧目录迟到回执重新定位。

现有(sourceId,bookId,sourceVersion) singleflight继续复用，搜索预取/点击/详情/书架/换源加入同任务；阅读优先、有界后台并发、旧sourceVersion不能发布到新状态。使用现有initiatedAt/generation/条件写保护，不新造缓存引擎。

### 9.4 诊断必须可消费

分类至少覆盖CACHE_MISSING、CACHE_DERIVED_CORRUPT、STORAGE_FAILURE、CANCELLED、IDENTITY_MISMATCH、SOURCE_VERSION_CHANGED、SOURCE_HTTP_FAILED、SOURCE_RESPONSE_FORMAT、SOURCE_RULE_FAILED、SOURCE_TOC_EMPTY、SOURCE_CONTENT_EMPTY。当前diagnostic仅赋值无消费者，必须贯通到错误呈现、问题记录和受控回放，不再只记message或统一parseFailed。

关联attemptId/requestId、source/book摘要、规则版本/hash、入口/cacheDecision/stage、HTTP状态、response类型/长度、finalUrl摘要、原始/可读条数和耗时。不要公开完整含token URL、cookie、密钥、正文/变量。真实失败响应单独受控留存并绑定hash；首次缓存失败cause不能在网络fallback后丢失。

不以Reader执行错误修改书源健康状态；不对“正常书源”作无证据反驳。两探针证明两类原因存在，尚无用户每个现场的源/响应回放，不能宣布全部失败已归因或虚构次数。

### 9.5 必测组合

bookUrl与baseUrl正对照均出同章；多页/重定向/变量优先级；持久目录×旧/缺/过期acquisition；冷SQLite裸数组/envelope；五入口同身份；删源离线；同名异源隔离；缓存故障分类；旧非空+新空/旧响应；卷标题/空首页/循环/预算耗尽；诊断消费者脱敏。每个失败探针转为正式回归，再做同包VM入口和离线恢复。旧英文错误现场样本作为额外归因门禁，不阻塞先修这两类确诊缺陷。

## 10. 亮度：真实跟手、自动状态与失败恢复

### 10.1 现根因

当前MOVE每16ms调用一次并不代表设备实时变化。生产方法探针中Window lookup耗时24ms、MOVE间隔16ms，所有中间写被generation检查淘汰，只有停指后最后一次真正setWindowBrightness。这足以解释“必须停下/脱手才变”，不能继续称只缺真机验证。

### 10.2 写入模型

窗口句柄由lifecycle owner缓存/复用，换window时才重新获取。`brightnessRequestId`与`windowOwnerGeneration`分开：新亮度值只能替代pending，不取消同owner正在执行的有效窗口查找/写；一个在途native write + 一个latestPending槽，写完立即排空最新值。中间样本可合并，但连续输入不能让系统写长期为0。

UI预览当帧更新，native writer按显示帧/合理限频提交；被限频掉的最新MOVE必须安排一次尾部frame flush，即使手指停住但仍按着也会写到最后值，不能只在UP flush。释放时flush最后真实坐标值，ack前不清preview跳回旧值。native慢/乱序回执不能覆盖新预览。本方案明确Cancel实现规则（非声称历史已定）：停止接收该手势新样本、丢弃未派发pending；已派发write经同一writer完成后，以其成功ACK/最后confirmed值为停留值，不跳回拖拽起点。Cancel不是脱离writer的独立回滚，新自动/手动意图可在同队列接续且旧ACK不得覆盖新意图。失败恢复最后confirmed亮度并给轻量反馈，不假称成功。

跟随系统时窗口亮度使用平台约定自动值；按钮状态由真实应用策略/最后成功应用值投影，不能只翻一个本地bool。拖动手动值即退出自动，自动按钮重新开启时取消pending手动请求，旧手动ack不能把自动状态冲回。“自动”表示窗口跟随系统亮度策略，不等于应用已开启设备全局环境光自动调节；文案和状态不得混淆。自动图标/轨道按设计选中态和App palette完整显示，不能仅靠1与.72微弱opacity把功能当验收。

窗口系统栏策略与亮度用各自写队列，不能每MOVE重复设置状态栏、安全区或重排正文。离开阅读失效旧owner；窗口级跨ReadingExperience实例的唯一writer在仍拥有窗口时恢复进入前应用策略，旧页迟到restore不能覆盖已获得窗口的新reader。该操作不影响系统全局设置；前后台重入重新确认当前owner。

### 10.3 回归

真实方法注入lookup0/24/100ms、write延迟/失败/乱序，连续MOVE、同值、快速反向、结束/取消、自动↔手动、离页/换窗口。专测最后MOVE落在节流窗口后停指且保持按住，末值无需后续MOVE或UP即可提交；专测阅读A退出→阅读B进入→A恢复晚到，不得覆盖B。确认连续输入中有持续系统写、最终值精确、队列至多一在途一pending、无饥饿/无旧值回闪。随后VM记录输入/请求/ACK/屏幕变化对应时间；真正物理亮度/自动环境响应仅在代码不能回答时按最小真机验证。

## 11. 原翻页、页面渲染、Make与性能范围完整保留

### 11.1 已有代码作为保护基线，不重复重写

本轮`prior-gaps-current-audit.md`逐项复核旧C段14项。已存在：冷准备保留DOWN+最新样本、flat/Native再抓、最终UP原子采样、tracking非tap保护、纵向previous映射、none取消复位、rapid边界净目标清理、连续图片锚补偿、首指锁、滚动上章尾锚直达、无条件A/B常驻。各项生产方法回归已通过，但没有把原生生命周期/屏幕帧/性能门禁改成完成。

**所有页模式继续支持**仿真、平移、覆盖、滚动、无动画，不为对齐某版Make的四项列表偷偷删除覆盖/滚动，也不把仿真重命名为淡入。如果要新增淡入，必须作为独立样式能力/菜单版本决定，当前修复先保持五模式语义不变。

### 11.2 呈现和持久提交的状态约束

沿用现有统一翻页事务及Native/ArkUI适配。显式区分tracking、settling、commitQueued、writing、durable、presentationPending、released，记录source/destination identity、layout/texture revision、pointer epoch、surface epoch、lifecycle和目标语义锚。phase与事实不能仅依赖多个互相矛盾bool。

- 仿真可见时禁止透明初始化/clear帧；paper正反面和底页始终有不透明阅读底，纹理更新失败保留上一合法画面。
- slide/cover的A/B物理实例固定，角色只换数据，隐藏slot不因idle/tracking/terminal切条件树；当前已有实现必须保留。使用原生attach/detach计数证明，而非仅看`.id`。
- `postFrameCallback`仅是调度回调，不是display fence。逻辑SLOTS_COMMITTED、目标内容ready、Native提交buffer、实际呈现与terminal释放分别记事件；不得“等两帧”当实际上屏证明。优先采用当前平台可验证的提交/呈现回执，真实无对应API时记录能力边界。
- 无精确display fence时，安全退路依赖常驻opaque目标/终帧和可恢复2D呈现所有权，不能为追求清理及时主动提交透明帧。目标版本/内容未准入前不释放旧画面；失败保留可操作源页或已确认目标的稳定二维页，不让UI永久等一个失联回执。
- Native surfaceLost、drop/迟到回执、初始化/上传/绘制/clear失败、旋转/后台/切模式都按同一generation释放资源，旧事务不能clear新surface。故障恢复不回滚已确认落盘进度。
- unknown写结果不能当failed。queued可取消；writing超时保留unknown并向Core串行查同身份目标锚。权威目标确认只promote一次，权威原锚且明确未写才回滚；结果不明保持可读页并提供重试查询，不重复写或猜测结果。
- continuous已有单drain与loadProgress对账，补永不返回、读失败、晚成功、外国写入/新会话、离页/重启的收敛状态；不能await任意Promise就报告最新滚动位置已保存。

### 11.3 对称跟手与性能实施

每个physical DOWN即拿pointer lease；手指停住仍按着时ready只能把最新样本交给同owner，不启动另一来源的自动动画。最终UP坐标先采样再决定提交；稀疏MOVE、反向UP、第二/三指提前UP与系统CANCEL分开。自动翻页/音量键/rapid/准备完成共用仲裁，不能绕过活跃pointer。

next/previous/verticalPrevious使用镜像基线比较：热同章、冷同章、冷跨章、前驱索引缺失、图片/超长章、再抓。按当前意图调度准备，前驱索引版本化复用；滚动尾章直达与分页真实页边界测量分开。无动画在内容/保存ready后不得额外补视觉时长，但不能假装无需真实排版/读取。

每个阶段记录input时间、采样/owner授予、资源ready、first visual、settlement、durable、release；输入事件时钟与VSync建立来源映射，异常时间不污染速度。MOVE只走已授权的轻量revision检查，watchdog按实际活动期限而非每事件新建。热MOVE不得重新测量全文、分配整页纹理或重绑全部17参数；已有provider/cache/二分索引保留。

控制栏性能沿用原生AttributeModifier差分、同帧几何/clip缓存、背景命中区域稳定对象、List可见行锚/逐行通知。继续隔离Panel响应式更新、真实宽高layout、文本重排、约20个blur actor和GPU成本；不得从属性调用减少百分比推导同等帧率收益，不删设计blur代替优化。

### 11.4 原52项逐项不丢的关联与关闭门禁

原52个ID是缺陷、保护约束和未验证项混合，不能称52个仍在发生的bug。下表完整覆盖F01–F09、C01–C08、N01–N15、P01–P15、R01–R05；原账每个具名包/通过/失败样本仍保留，当前门禁不继承旧包通过。

| 原ID | 本规格承接内容/关闭证据 |
|---|---|
| F01/F02/F06/F09 | 不透明底、禁止透明clear、主题alpha与交接；逐帧无闪白/露底，§11.2 |
| F03/N14/N15 | surfaceEpoch/lifecycle、丢回执/迟到/旋转/后台/clear重建故障；源目标无误释放，§11.2 |
| F04/N04/N06/N07/N10 | 正/背/相邻页角色、纹理寿命、图片冷解码、分钟/主题/高亮身份、色域/过滤/暗带；逐actor像素与资源计数 |
| F05/P06 | 常驻A/B，所有内容与快速交错原生实例计数；不能以离屏快照树build冒充正文重挂载 |
| F07/N09 | glyph/UTF16/scalar矩形、64矩形预算及显式降级、夜间/图片/动态高亮与终帧连续性 |
| F08 | 五模式完整功能与故障矩阵；保留800次等历史样本范围，不把新包自动标通过 |
| C01/C02/C03/C07/N11/N13/P12/P14 | UI/Native/GPU/GC、帧预算、分配峰值、缓存上界/长期资源；已有差分/索引/轻量MOVE不回退 |
| C04/C05 | 深目录fraction、滚动/排序/筛选/书签变化、动画中迟到数据/删除/下载状态；固定可见锚，不回顶部 |
| C06/N05/P15 | 停指冻结、自动动画再抓/反向/释放连续速度、异常时钟；十轮连续MOVE再抓和中段像素 |
| C08 | “最近书签”的语义旧项保留；本次不偷偷改选择规则，见§13提案边界 |
| N01/N02/N03/P01/P02/P03/P11 | 最新物理样本、首指、最终UP、next/previous/纵向、冷热准备/停住仍按着；输入到首像素分布 |
| N08 | 调度≠display fence；独立呈现回执/opaque安全退路及屏幕连续性，§11.2 |
| N12/P05 | 快速点击吞吐、边界无效方向/立即反向；正确净目标和提交次数，不把HDC耗时当应用吞吐 |
| P04/P13/R04 | none/CANCEL、首指与多来源仲裁、自动/音量键/多指/程序滚动，不额外跨章 |
| P07/R02 | 慢/失败/未知持久写结果、实际锚对账、离页/重启收敛，不误回滚 |
| P08 | 《绍宋》第34章6/11页44%同页码但首行不同；复现必须绑定原文hash、canonical scalar、layout/page身份，别拿新样例oracle关闭旧案 |
| P09/P10/R05 | none冷ready延迟、前驱/邻章读、滚动上章尾部与超长章耗时；禁止把滚动和分页准备混成一项 |
| R01/R03 | scalar量化/内边距、图片fragment+fraction、慢解码/多图/字体变化/章尾/模式切换锚保护 |

性能输出至少含sample数量、设备/频率、输入/内容/状态、p50/p95/p99/max、长帧数、主线程/Native/GPU边界、资源峰值和source/manifest。60/120Hz按实际刷新率预算16.67/8.33ms统计，不承诺凭VM达到物理120Hz。历史57.926/28.515/27.118ms和PSS/heap变化是历史样本，必须保留来源，不能写成当前已改善/无泄漏。

GPU、触控到屏幕、温升功耗和长时资源仍独立开放。优先现有录像/trace和代码归因，再用绑定候选的VM。真实硬件指标只有代码无法回答时按最小问题取证，HDC命令耗时与屏幕帧不混算。

### 11.5 本次整理额外发现的本地书回归

Core `5aac38327349ed7089d262b3a8173e1ed794c1d3`仅WIP归档，不能交付。大文档≥128KiB切streaming出现四个实际失败：`<br>`丢换行；script字符串含`<style>`吞掉后续正文；textarea字面标签被当结构；4097+锚点因take(4096)丢失。253常规测试通过没有覆盖这些，四个新探针全失败；安全前置`c42af9a1f`独立252测试通过。

实施复用已锁定scraper/html5ever 0.27.0标准HTML语义/tree builder，性能优化只作用于Reader文本/图片/锚点投影和复用，禁止大小阈值切换不等价解析器。优先标准语义单路径；如果上游现成能力能完整承担，必须用上游，不能再补手工script/textarea深度计数。必要的定制适配给出不等价样本和退出旧路径步骤。

锚点预算覆盖实际目录需要；超出明确完整性失败，不能静默截断。按阈值两侧、br/rawtext/RCDATA、4096/4097、Unicode、图片偏移、元数据、spine首中尾与进度/书签做差分。性能仍是每本真实样本10秒目标，不以平均值掩盖慢书；大图/字体/CSS、真实MOBI6语料等旧缺口保留。这是本地格式独立问题，不归因远程book.toc。

## 12. 实施拆分、依赖、提交与验收

| 批次 | 修改范围与顺序 | 独立完成门禁 |
|---|---|---|
| S0 合同冻结 | 本规格、来源hash、旧错误声明作废、配色/几何/状态真值表；本轮已整理旧工作树 | 每个ID能追到来源/现源码/具体改法/失败测试；明确提案和用户决定 |
| S1 数据正确性 | Core TOC上下文、Host缓存准入/诊断；本机配置单源；导入attempt；本地streaming修正分独立提交 | 6个新生产方法缺陷探针和4个parser探针转为通过；保进度/凭据/书架；无设备依赖 |
| S2 主题/窗口基础 | registry与两scope、4选择状态、迁移/同步、双向reducer、1开关/metrics/window owner、亮度writer | 真值表/迟到/失败恢复/跨平台配置回放；所有消费者有明确角色和能力边界 |
| S3 胶囊 | 准备事务与稳定actor→四入口几何→共享keyframes→footer→打断/资源/降级 | Figma全采样点、业务延迟与snapshot故障、单owner/无换树、无布局/分页每帧更新 |
| S4 视觉和业务接缝 | 列表/source/progress/批量，轻量整理与菜单，控制内容、导入result/motion、搜索history/loader、正文inset | 逐ID几何/字体/命中/状态回归；已知图稿尺寸精确；提案不得擅作已批准设计 |
| S5 翻页与性能剩余 | 保留已改保护链，补fence安全交接、unknown写入、故障/场景矩阵、独立试听及性能分层 | 原52ID逐一更新对应证据；不重写已有通过方法；每次优化须同输入差分 |
| S6 构建与VM | 停止共享源写入→本地相关测试→ArkTS/Core门禁→isolated pipeline构建/verify→明确target保数据安装 | immutable manifest绑定所有源码/依赖、签名/运行BuildId；非裸HAP/非DevEco Run替代；本轮未执行 |
| S7 最小硬件与用户验收 | 仅剩代码侧无法解释的原生触控/实际系统栏/音频/物理亮度/性能问题 | 每次先记录已审计/已排除/具体待答问题，合法目标与独占锁；VM/真机/用户三栏独立关闭 |

共享文件LocalReadingExperience/Index/ReaderControlPanel由一个集成owner串行编辑，独立Core/模型/设计取证可并行；Agent不能同时占同一个Git index或同一设备。每个提交只含一个业务切片及对应测试/证据；对跨文件hunk按实际依赖切分，禁止让测试静默放松到错误实现。发现新问题先记根总账，并优先代码定位，不继续真机重复抓。

每个实现完成声明须给：合同ID、源码hash/提交、变化前后行为、生产方法失败→通过证据、剩余证据层。测试总数不是完成百分比。当前198组本地通过只能作为整理前后保护基线；存在错误设计断言的套件必须替换，不把新文档当修复。

交付前必需：WIP项目全部实现并回归，源码指纹稳定；无未经批准的菜单/视觉替换；所有可达按钮有确定动作和失败状态；本地数据保留；同manifest VM逐项检查；无法取得的真机/视觉/用户证据明确OPEN，不能用安装成功写“全量完成”。

## 13. 仍需确认/补证的精确边界

已经定下、不得再提为产品待决：胶囊图标/文案/暂停键/页码完整轨道；TOC同源缓存与上下文修复；一个刘海开关和状态栏优先级；顶部信息/系统栏Reader色、胶囊App色；App两套/Reader八套、同scheme不取消system的双向联动；ID同步/手动冲突；书架四行不改字体、source名称与progress分列；单书75%不透明；超高结果滚动；轻量默认分组整理。

本方案已给出具体可执行提案、但不能冒称历史已确认的范围：

1. **顶More动作名单/书架设置分区、阅读More名单**：§5给出完整建议。已确认的图只定样式，轻量整理有原始用户原文；没有证据授权当前恢复CRUD或More直接改书签。
2. **正文新默认边距**：旧值32/44.44已核实，根因已复现；§3.4给出明确新公式与样例，需要对新视觉数值确认，不需要再讨论是否要共享测量/渲染宽度。
3. **Night剩余浅表面和状态对色**：现有88项中可复用部分已取证，补齐候选附表列明；需要成对合成预览确认，不要求用户重新定义所有颜色。
4. **导入/搜索精确motion参考**：搜索Make源码/CSS已取得，1000ms线性旋转已定；导入目标树递归motion为空，且该Make仅包含搜索而不包含本地书导入。导入附表给出明确候选。不把此边界扩成“Figma没有完整胶囊动效”。
5. **旧C08最近书签与淡入选项集合**：保持当前规则/五模式，不借本轮修复私改；若要求改语义或新增淡入，须明确其单独产品差异。它们不阻塞已确认21项中的代码正确性修复。

证据不足而非产品未定：用户每个历史TOC失败源的原始响应归因；《绍宋》原案当时scalar/layout；当前同包Native呈现/GPU/120Hz/温升功耗/实际音频/真实亮度/系统栏着色。为这些补证前仍先做本地复放，不能把缺证据说成方案不能实现。

## 14. 证据索引

本轮原始取证集中在 `evidence/2026-09-13-current-gap-register/`：

- `capsule-current-audit.md`、`capsule-figma-live.json`：四入口完整设计/轨道与十类根因。
- `toc-current/REPORT.md`及同目录探针/日志/hash：两类远程TOC生产复现、当前缓存链与十组门禁。
- `surface-current-audit.md`、`surface-current-probe.mjs`：导入、持久模式、边距、亮度四类真实方法复现。
- `bookshelf-more-history-audit.md`：原始用户决定、9张历史图的实际位置与最新样式节点。
- `theme-figma-app-colors-audit.md`、`theme-figma-app-colors-live.json`：完整88项日夜颜色、直接复用及补齐候选。
- `theme-control-role-mapping.md`：控制/TTS逐消费者映射、混用token拆分与四场景48个actor ID。
- `import-search-motion-current-audit.md`与`import-search-motion-raw/`：真实按钮318宽、静态actor几何、motion返回边界及候选。
- `prior-gaps-current-audit.md`：旧14项/Make七组/性能继承当前复核。
- `current-local-contracts.log`：本轮198组现有本地检查通过，非全量行为验收。
- `core-commit-review/`：3个Core整理提交和streaming4个失败探针。
- `workspace-commit-receipt.json`：提交边界、原始字节保留、各工作树状态与未交付声明。

历史设备/构建/失败日志保留原目录，附历史快照说明；旧CURRENT_GAP_REGISTER/THEME_ARCHITECTURE_AUDIT等文件不再作为当前决策入口。根总账§11维护后续状态，本规格只在需求/实施合同变化时显式修订。
