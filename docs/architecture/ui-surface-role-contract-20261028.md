# UI 表面角色与绘制职责契约 v3（2026-10-28）

状态：评审草案（职责与现状登记版）。本文件不修改生产代码、主题 token、版本或设备状态。视觉调整只登记为候选项；是否迁移及具体 token 由后续静态 demo 决定。

范围：HarmonyOS 主结构路线 `Reader-for-HarmonyOS`（不是动效 WIP worktree）；App 域表面为主，Reader 域只登记边界与专用角色；昼间为主，夜间逐项对照。设备像素与交互验收不在本文件登记范围内。

登记基线：Harmony HEAD `3b297fdc7e724cf655eca3bac2a8efeda2001c56`、Core `80d614e929ae9e320ab767a1dc04579363c361d7`、Reader-UI `95366cd93775ea0ad3ecbc0f60e8882717f93169`，均有既有 dirty WIP，原样保留。产品版本仍为 0.2.0。

## 1. v3 相对上一稿的修订

1. **五轴解耦**：域只保留 `App / Reader`；`Message / Control` 是与域并存的类别标签；布局只保留 `in-flow / attached / overlay`；表面角色只保留 `page / embedded / docked / raised / modal / none / inherit`；交互是多能力集合，`blocking` 不再是布局值。
2. **删除“覆盖内容就改 raised”的推导**：覆盖绘制、内容避让、docked 材质可以同时成立。`ReaderPageScaffold` 的 header 本来就是 z10 覆盖 Stack，内容避让由 `ReaderPageGeometry.startInset` 提供，是否抬升是目标视觉关系，不是覆盖的自动结果。
3. **搜索几何改为基准值**：保留默认手机字号下的 52/16/18 设计基准，平板外边距基准 20；高度、控件宽高继续走字体缩放函数，安全区继续由现有 owner 解析，不冻结为固定几何。
4. **结构问题与视觉问题分开**：圆角顶栏无影、内嵌卡比纸底亮、chip 填色等只登记为视觉候选，不能单独证明结构错误。每个组件分别登记外框、阴影、遮罩、裁剪、显隐关闭和触发源由谁负责；`ReaderSelectPanel` 内容与 `ReaderInlineSelect` 的原生 `bindPopup` 必须分列。
5. **demo 补齐平板并拆分验证**：320/366 只是手机档；600vp 是展开断点，需补 600/840 的 rail/popover 分支。静态对比只验证层级、边缘和包含；背景隔离、焦点循环、关闭恢复必须单独做交互验证。浏览器 demo 只证明 demo 本身，modal 行为参照 W3C modal dialog 模式。

## 2. 五个独立轴

| 轴 | 取值 | 约束 |
|---|---|---|
| 域 | `App / Reader` | 事实归属；决定可用的色板与表面规格族。Reader 正文/控制不得被 App 纸底角色覆盖。 |
| 类别标签 | `Message / Control`（可叠加，可缺省） | 组件类别，与域并存；不是布局，也不是表面角色。 |
| 布局关系 | `in-flow / attached / overlay` | 只描述与页面流、滚动和视口边缘的关系。 |
| 表面角色 | `page / embedded / docked / raised / modal / none / inherit` | 只描述材料承载关系；`none` = 不形成独立表面，`inherit` = 明确沿用父表面；不出现 `message / reader / control` 这类与域或类别重复的值。 |
| 交互能力 | 多选集合：`persist / press / expand / dismiss / block / transient / focus-trap / focus-return / keyboard` 等 | 按用途登记，不要求所有表面拥有同一组能力。 |

`L0–L4` 继续作为设计名称使用，不承担分类：

| 设计名称 | 通常对应 |
|---|---|
| L0 | `page` |
| L1 | `embedded`（通常 `in-flow`） |
| L2 | 附着/边缘工具带（表面角色可为 `docked` 或 `raised`） |
| L3 | `raised`（`overlay`） |
| L4 | `modal`（`overlay` + `block`） |

`none / inherit` 不属于 L0–L4：它们是“无独立承载”的登记值。`docked` 只用于真正附着页面的材质（如固定顶栏）；漂浮在视口边缘的底栏和 dock 仍登记 `raised`，靠近边缘不改变材质关系。

名称不是判定依据。同一组件可以同时是 `App · Control`、布局 `attached`、表面 `raised`、交互 `{persist, press, select}`。

### 2.1 判定顺序

1. 事实与域：谁拥有数据、状态和写入。
2. 类别标签：是不是消息，是不是控件；两者可同时成立。
3. 布局：随内容滚动、附在页面边缘、覆盖内容。
4. 表面角色：与页面同一材料、内容流内可辨识、附着边缘、高于内容但非阻断、阻断背景，或不形成独立表面（`none`）/明确沿用父表面（`inherit`）。
5. 交互能力集合与生命周期 owner。
6. 绘制宿主：外框、阴影、遮罩、裁剪、显隐/关闭、触发源分别是谁。
7. 参数来源：颜色、表面规格、几何、字体/动效是否回到现有 owner。

### 2.2 判定示例

- 搜索栏：`App · Control · overlay · docked · {persist, press, expand}`。它覆盖内容并由 header 的 `startInset` 避让，不因为覆盖就变成 `raised`。
- 底栏：`App · Control · attached · raised · {persist, press, select}`。它靠近视口边缘，但材质高于页面，不是 `docked`。
- 阅读器确认框：`Reader · Control · overlay · modal · {block, keyboard, focus-trap, focus-return}`。“Reader”与“modal”不矛盾，因为它们在不同轴上。
- 书架列表行：`App · Control · in-flow · none · {press}`。它是内容流内的行，不形成独立承载，也不应被归到 L1 悬浮类。
- 阅读器按钮：同样是 `Control`，表面记 `none`，不形成独立卡片；必须满足控件契约（命中区、字体缩放、可访问名称、按下反馈），配色和表面沿用 Reader 专用角色，不迁到 App 表面角色。

### 2.3 控件外观 ≠ 承载角色

chip、按钮、行内控件可以有填色、边框、圆角，但只要不形成独立承载表面，表面角色记 `none`；如果它明确沿用父表面，记 `inherit`。不得因为填色/边框就归为 `embedded`，也不得因为靠近视口边缘就归为 `docked`。

## 3. 硬约束

### 3.1 避让只约束常驻遮挡

`overlay` 本身合法，但避让要求按用途区分：

- **常驻导航/工具带/dock/固定 header**：内容会滚动到其下方且控件持续存在时，必须通过 `startInset / endInset / nativeEndInset` 避让，或登记明确的“不避让”业务例外。避让 owner 是 `ReaderPageGeometry`：`startInset` 接 header clearance，`endInset / nativeEndInset` 接滚动尾部预算；solid footer 同时抬高两者（`ReaderPageGeometry.ts:37-43`、`ReaderPageGeometry.ts:145-158`）。
- **临时菜单/下拉/popup/sheet/模态**：允许临时覆盖内容，不要求预留布局；但必须可关闭、关闭后恢复触发源/滚动上下文，不能让内容永久不可达。
- `ReaderPageScaffold` 的 header 是覆盖绘制 + `startInset` 避让的常驻例子；`overlay · docked` 合法（`ReaderPageScaffold.ets:47`）。
- L2 的视觉边缘或渐隐不是布局避让；它只解决视觉边界，不能让常驻控件遮挡的最后一行不可读。

### 3.2 一套承载关系只画一个外框

- 禁止同一承载关系重复绘制外框；合理嵌套允许。
- 子表面可以画内容、行、选中态，但不得再画同层外框。
- 原生宿主路径下，内容不得增加第二个 background/border/radius/shadow。`ReaderBoundedSurface` 的 sheet 路径只设置宽度和底部 padding，明确由 native `bindSheet` 画纸底、圆角、裁剪和安全底边（`ReaderBoundedSurface.ets:64-69`）。
- 嵌套不是问题：L1 卡片里的按钮可以打开 L3 下拉；L4 模态内部可以分组、展开、选择，只要背景隔离仍然成立。

### 3.3 绘制宿主六项分工

每个组件至少登记：

| 项 | 要回答的问题 |
|---|---|
| 外框 | 谁画 background、border、radius |
| 阴影/抬升 | 谁选择 elevation，是否与圆角裁剪冲突 |
| 遮罩 | 谁画 scrim，是否真正阻断背景 |
| 裁剪 | 谁 clip：外框、内容、还是原生宿主 |
| 显隐/关闭 | 谁拥有 show/close 生命周期 |
| 触发源 | 谁打开它，关闭后回到哪里，身份/代际如何防旧回调 |

原生宿主与自绘表面的差异必须显式写出：

- `ReaderSelectPanel`：面板自己画面板外框和阴影；`default / sourceGroup` 用 `fixed`（零影），`appearanceLibrary` 用 `popover`；面板自己 `clip`，没有遮罩；位置由宿主页面给出（`ReaderSelectPanel.ets:148-166`）。
- `ReaderInlineSelect`：面板仍画内容框，但最终窗口外缘/阴影由原生 `bindPopup` 负责，`popupColor` 是 `Color.Transparent`（`ReaderInlineSelect.ets:53-56`、`ReaderInlineSelect.ets:99`）。只看子面板不能判断最终边缘，也不能据此断言结构错误。
- `ReaderMangaDownloadPopup`：原生 popup 提供窗口填充与边缘，`popupColor` 为 `TOK_CARD_BG`；内容面板只负责滚动和 padding（`ReaderMangaDownloadPopup.ets:31-44`）。
- Native sheet：`bindSheet` 宿主画纸底、圆角、裁剪、遮罩和关闭；内容不画第二框（`ReaderBoundedSurface.ets:64-69`）。
- 自绘对话框：宿主画 scrim 和 show/close；`ReaderDialogSurface` 只画卡片外框、边框、圆角和阴影（`ReaderDialogSurface.ets:37-53`、`ReaderDialogSurface.ets:94-112`）。
- 来源切换：`ReaderShell` 画 `TOK_SS_DRAWER_SCRIM` 并拥有开关；抽屉面板画顶部高光、顶部圆角、裁剪和 sheet 阴影（`ReaderShell.ets:378-396`、`ReaderBoundedSurface.ets:27-33`）。

### 3.4 覆盖 ≠ 抬升

`ReaderPageScaffold.ets:47` 的 header 是覆盖层，内容避让由几何体提供；这允许 `overlay · docked` 的合法组合。是否抬升取决于目标视觉关系：

- 固定顶栏可以保持 docked 材料，只靠边界、纸底和内容避让区分；
- 需要读成“高于内容”时，才选择 `raised` 和相应阴影/边缘；
- 不能因为“覆盖了内容”就自动加阴影，也不能因为“没有阴影”就判为结构错误。

### 3.5 参数只有一个权威

| 类别 | 权威 | 不允许 |
|---|---|---|
| 颜色 | `Reader-UI/theme/registry.json`，生成到 `ReaderThemeRegistry.ts` | 手改生成物、组件内写死新色值、另建第二套色板 |
| 表面抬升与模态规格 | `ReaderSurfaceSpecs`（elevation、Drawer、Dialog、Sheet、Popup specs） | 组件局部写 shadow/radius 来“修层级” |
| 页面几何与避让 | `ReaderPageGeometry`、`ReaderPageShell`、`ReaderHeaderSpecs`、`SurfaceHorizontalGeometry`、`ReaderFloatingBarMetrics` | 页面内散落 magic inset |
| 搜索控件几何 | `ReaderSearchControlGeometry` + `SearchHeaderSpec` | 把 52/16/18 冻结成新常量 |
| 字体与动效 | `ReaderTypography`、`MotionSpec` | 组件局部字号/时长 |

### 3.6 几何是基准，不是冻结值

默认手机字号下：

- 搜索控件高度 `36`，上下 bar padding 各 `8`，合计 `52`（`ReaderSearchControlGeometry.ts:11`、`ReaderHeaderSpecs.ets:117-118`）。
- 手机外边距基准 `16`，平板 `20`；面板圆角 `18`；面板内边距 `12`（`ReaderHeaderSpecs.ets:108-118`）。
- 控件高度和宽度继续走 `readerSearchControlHeight(fontScale)` / `readerSearchActionWidth(fontScale)`；安全区继续由现有 metrics/inset 解析。
- 这些值是 demo 和视觉对照的基准，不是新几何 owner，也不能替代字体缩放和安全区。

### 3.7 域与消息边界

- App 表面使用 registry 的 App 角色；Reader 正文/控制使用 `TOK_READ_*`，不得被 App 纸底或普通 modal 角色覆盖。
- 消息按业务事实归类，跟随当前有效宿主，同一宿主去重/退休旧宿主，不设全局“永远最上层”的消息层；分类和生命周期按 `docs/message-ui/FRAMEWORK.md:22`。
- 消息是类别标签，不是表面角色；toast/notice 的表面角色可以是 `raised`，但它的类别仍是 `Message`。

## 4. 组件职责登记（现状）

缩写：`外框` = background + border + radius；`影` = elevation/shadow；`遮` = scrim/mask；`裁` = clip；`显/关` = show/close 生命周期；`触发` = 触发源 + 身份/代际。

### 4.1 页面骨架与顶栏

| 组件/区域 | 现状（代码事实） | 目标（域·标签·布局·表面·交互） | 参数 owner | 外框 / 影 | 遮 / 裁 | 显/关 · 触发 | 视觉候选 / 状态 |
|---|---|---|---|---|---|---|---|
| `ReaderPageScaffold` 内容/header/footer/overlay | content z0、header z10、footer z20、overlay z30；header Stack 覆盖，内容按 `nativeEndInset` 收缩（`ReaderPageScaffold.ets:42-68`） | App · — · content `in-flow`；header/footer `overlay` · `none`（骨架不画材料） · `{persist}` | `ReaderPageGeometry`、`ReaderPageScaffold`、`ReaderFrameStyle` | 页面/frame modifier；header/footer 内容各自画 | 无遮罩；`nativeEndInset > 0` 时内容裁切 | 页面宿主持有；header/footer 测量 key | 无结构候选；既有 |
| `AppTopBar` 标准 | solid 用 `TOK_PAPER`，可选底分隔线，无圆角；elevation 默认 `fixed`（零影）（`AppTopBar.ets:112-117`） | App · — · `attached` · `docked` · `{persist, press}` | `AppTopBar`、`bookshelfHeaderSpec`、`ReaderSurfaceSpecs` | 顶栏自画；fixed 零影 | 无遮罩；不裁 | 页面持有 | V6 顶栏无影；既有 |
| `AppTopBar` floating | 白面 + 控制边界 + r18 + `clip(true)`；elevation 默认 `fixed`（`AppTopBar.ets:109-117`） | App · — · `overlay` · `docked` · `{persist, press}`；V6 决定是否改为 `raised` | 同上 | 顶栏自画；影由 elevation | 无遮罩；`clip(true)` | 页面持有 | V6；视觉候选 |
| `PageBackBar` 标准 | `TOK_SURFACE_SOLID`，无边框/圆角；elevation 默认 `fixed`（`PageBackBar.ets:88-93`） | App · — · `attached` · `docked` · `{persist, press}` | `PageBackBar`、`ReaderSurfaceSpecs` | 自画；fixed 零影 | 无遮罩；不裁 | 页面持有 | 既有 |
| `PageBackBar` floating | 标准详情 veil/raised；漫画及默认路径保留 solid/fixed | 标准详情 App · — · `overlay` · `raised` · `{persist, press}`；漫画保持 `docked` | `ReaderHeaderSpecs`、`ReaderSurfaceSpecs`、registry | 面板画材质/边，零尺寸 `ReaderRaisedSurface` 画三层外影 | 面板内裁、外层不裁；标准 raised 面板 Default 防同级穿透 | 详情页持有 scrolled/书籍身份，栏体持有尺寸回执 | 366 日间定稿；源码已接入，整页/设备待验 |
| 搜索栏面板 | 书架 idle/history≤.01 用 veil，历史呈现高度归零后用三层影；展开清除 effect 并恢复不透明面板和原 fixed/popover 影 | idle App · Control · `overlay` · `raised` · `{persist, press, expand}`；展开另按 modal | `SearchHeaderSpec`、`ReaderSurfaceSpecs`、registry；书架 guarded scrolled | 面板画框/材质并回报实际边框宽高；零尺寸 Canvas 复用同几何输入的收起态实测框画外影 | 面板 clip(true)/Default；影外层不裁；历史 scrim 保留 | 搜索 owner/identity/navigation/mount；底层 List 锚点保留；展开测量不覆盖收起框 | 366 日间定稿；8vp 压栏与安全线分离，整页待验 |
| 搜索历史展开 | 历史面板在 header 内展开；32% `app.scrim.modal` z1，结果 z2，header z4；结果 `clipShape`；背景点击回退（`ReaderLibrarySearchSurface.ets:657-680`） | App · Control · `overlay` · `modal` · `{expand, dismiss, block, focus-trap, focus-return}` | `ReaderLibrarySearchSurface`、`app.scrim.modal` | 搜索表面自画；无独立外框 | 搜索表面画遮罩；结果裁切 | 搜索页 identity/`backAction` | 目标 modal；背景隔离、焦点约束、关闭恢复分别待验证；失败即契约未满足，不改判非模态 |
| 下载页顶栏 | `TOK_SURFACE_SOLID` + `app.border.control` + r18 + `clip(true)` + `fixed` 零影（`SharedDownloadPage.ets:319-323`） | App · — · `attached` · `docked` · `{persist, press}` | `SharedDownloadPage`、`ReaderSurfaceSpecs` | 顶栏自画；fixed 零影 | 无遮罩；`clip(true)` | 页面持有 | V6；视觉候选 |

### 4.2 内容流内嵌

| 组件/区域 | 现状（代码事实） | 目标（域·标签·布局·表面·交互） | 参数 owner | 外框 / 影 | 遮 / 裁 | 显/关 · 触发 | 视觉候选 / 状态 |
|---|---|---|---|---|---|---|---|
| 继续阅读/分组/来源卡 | `TOK_CARD_BG` + `app.border.contentCard` 1px；继续阅读 r18，`ReaderCardSpecs` r8/12；无阴影（`ReaderCardSpecs.ets:17-34`、`BookshelfPage.ets:612-613`） | App · — · `in-flow` · `embedded` · `{press, navigate}` | `ReaderCardSpecs`；registry App roles | 卡片自画；零影 | 无遮罩；不裁外框 | 列表/页面持有 | V1 卡比纸亮；V3 r18 复用；既有 + 视觉候选 |
| 筛选/历史 chip | `TOK_CARD_BG` + `TOK_BORDER`，r10 或 r999；选中态用深绿（`ReaderControlSpecs.ets:249-270`、`BookshelfPage.ets:896-901`） | App · Control · `in-flow` · `none` · `{press, select/toggle}` | `ReaderControlSpecs`；registry | chip 自画；零影 | 无遮罩；不裁 | 页面/列表持有 | 填色/边框不等于独立承载；V4 只改控件外观，不升级为 embedded |
| 来源行/分隔行 | 透明行 + 分隔线，无独立外框 | App · Control · `in-flow` · `none` · `{press, select}` | 页面规格 | 行自画/透明 | 无遮罩；不裁 | 页面持有 | 不把分隔行误判为 L1；既有 |
| 搜索结果/内容列表行 | 无浮层外框；层级由排版、分隔和内容预算表达 | App · Control · `in-flow` · `none` · `{press}` | 搜索页规格 | 内容自画 | 结果面裁切 | 搜索页持有 | 不新增外框；既有 |

### 4.3 常驻悬浮工具带

| 组件/区域 | 现状（代码事实） | 目标（域·标签·布局·表面·交互） | 参数 owner | 外框 / 影 | 遮 / 裁 | 显/关 · 触发 | 视觉候选 / 状态 |
|---|---|---|---|---|---|---|---|
| 底栏 / rail | 原底/边/pill 与自然高度保留；外包装共用三层影，移除旧单层 shadow | App · Control · `overlay` · `raised` · `{persist, press, select}` | registry navigation roles；`ReaderSurfaceSpecs`；`ReaderFloatingBarMetrics` | 原面板画材质/边；零尺寸 `ReaderRaisedSurface` 画外影 | 无遮罩；clip(false)；画布 None | shell 持有；原面板尺寸回执供影；margin/translate 由外包装唯一持有 | 源码已接入，原样绘制子组件原生自然测量通过；整页待验 |
| 书籍详情 dock | 原 dock 底/边/r24/尺寸保留；统一三层影 | App · Control · `overlay` · `raised` · `{persist, press}` | registry dock roles；`ReaderSurfaceSpecs` | dock 画材质/边；共享 Canvas 画外影 | 无遮罩；clip(false)；画布 None | 详情页持有；沿用原内容避让 | 源码已接入；整页/尾部留白待验 |
| 下载 dock | 两 dock 保留原底/边/r18/尺寸；统一三层影 | App · Control · `overlay` · `raised` · `{persist, press}` | 同上；原下载测量 owner | dock 画材质/边；共享 Canvas 画外影 | 无遮罩；clip(false)；画布 None | 下载页持有；同一高度仍进入 download:dock 避让测量 | 源码已接入；整页/夜间/字号待验 |
| 阅读器会话胶囊 | `TOK_READ_SURFACE`、`TOK_READ_ELEVATED`、`TOK_LINE_STRONG`；r24/12/8（`ReaderSessionCapsule.ets`） | Reader · Control · `attached` · `raised` · 维持既有交互 | Reader 专用角色；`ReaderTypography` | 阅读器自画；专用影/边 | 视具体面板 | 阅读会话持有 | 目标 raised；不迁 App 角色；仅借鉴边缘/影关系 |
| 阅读器控制带/目录 | `TOK_READ_SURFACE`、`TOK_READ_ELEVATED`、`TOK_LINE_STRONG`；r24/12/8（`ReaderControlPanel.ets`、`FullDirectoryPanel.ets`） | Reader · Control · `overlay` · `raised` · 维持既有交互 | Reader 专用角色；`ReaderTypography` | 阅读器自画；专用影/边 | 视具体面板 | 阅读会话持有 | 不迁 App 角色；仅借鉴边缘/影关系 |

底栏、rail、详情/下载 dock 属于常驻遮挡：内容尾部避让由所在页面的 `endInset / nativeEndInset` 负责，不在组件内部再画避让；滚动尾部是否完整由 demo 的静态包含检查和实际滚动分别核对。

### 4.4 非模态浮层/下拉

| 组件/区域 | 现状（代码事实） | 目标（域·标签·布局·表面·交互） | 参数 owner | 外框 / 影 | 遮 / 裁 | 显/关 · 触发 | 视觉候选 / 状态 |
|---|---|---|---|---|---|---|---|
| `ReaderSelectPanel` default/sourceGroup | 面板自画 background/border/radius；r6/8，`clip(true)`；`fixed` 零影（`ReaderSelectPanel.ets:148-166`） | App · Control · `overlay` · `raised` · `{expand, select, dismiss, focus-return, transient}` | `ReaderSelectPanel`；registry select roles；`ReaderSurfaceSpecs` | 面板自画；零影 | 无遮罩；面板裁 | 宿主页定位/显隐；选择身份 | V5 零影；视觉候选 |
| `ReaderSelectPanel` appearanceLibrary | r9，padding 3，`clip(false)`，`popover` 影（`ReaderSelectPanel.ets:154-166`） | App · Control · `overlay` · `raised` · 同上 | 同上 | 面板自画；popover 影 | 无遮罩；外框不裁 | 宿主页持有 | 既有 popover 分支 |
| `ReaderInlineSelect` | 原生 `bindPopup`；`popupColor` 透明；`focusable: true`、`autoCancel: true`；内容仍是 `ReaderSelectPanel`（`ReaderInlineSelect.ets:53-56`、`ReaderInlineSelect.ets:99`） | App · Control · `overlay` · `raised` · `{expand, select, dismiss, focus-return, keyboard?}` | 面板 + 原生 popup | 面板画内容框；原生 popup 画窗口边缘/影 | 原生 popup 遮罩/关闭；面板自裁 | 原生 popup + `selectionId` 代际 | V5b 最终边缘不由子面板决定；待设备/交互 |
| `ReaderMangaDownloadPopup` | 原生 `bindPopup`；`popupColor: TOK_CARD_BG`；内容只滚动/padding（`ReaderMangaDownloadPopup.ets:31-44`） | App · Control · `overlay` · `raised` · `{expand, dismiss, retry?}` | `READER_MANGA_DOWNLOAD_POPUP`；原生 popup | 原生 popup 画窗口填充/边缘；内容不画第二框 | 原生 popup 关闭；内容滚动 | 父组件持有可见性和 generation | V10 原生边缘；设备待验证 |
| `SettingsSelectOverlay` 手机 | 全屏 `app.scrim.select`；底部 `app.surface.menuSolid` + `app.border.control` + 顶部 r18 + `sheet` 影（`SettingsSelectOverlay.ets:80`、`SettingsSelectOverlay.ets:130-168`） | App · Control · `overlay` · `modal` · `{block, dismiss, select, focus-return}` | `SettingsSelectOverlay`；registry select roles；`ReaderSurfaceSpecs` | 面板自画；`sheet` 影 | overlay 画遮罩；面板裁内容 | overlay 持有；identity 关闭 | 手机 modal，平板 popover；行为待验证 |
| `SettingsSelectOverlay` 平板 | `expandedLayout` 透明背景；tablet 面板 + border + `popover` 影，按 anchor 定位（`SettingsSelectOverlay.ets:80-94`、`SettingsSelectOverlay.ets:182-201`） | App · Control · `overlay` · `raised` · `{expand, dismiss, select, focus-return}` | tablet `PopupSurfaceSpec` | 面板自画；popover 影 | 透明遮罩；内容裁 | 页面持有；anchor 触发 | 既有 popover |
| `SourceManagementPage` 分组浮层 | 全屏透明点击捕获 + `ReaderSelectPanel` `sourceGroup`；无 scrim（`SourceManagementPage.ets:265`） | App · Control · `overlay` · `raised` · `{expand, dismiss, select}` | 面板 + 页面 | 面板自画；零影 | 无遮罩；面板裁 | 页面持有；点击捕获关闭 | V5 自绘分支；与原生 popup 分开评审 |
| `BookshelfMoreMenu` | popover 影；`clip(false)`；自绘宿主（`BookshelfMoreMenu.ets:102`） | App · Control · `overlay` · `raised` · `{expand, dismiss, focus-return}` | popup spec；`ReaderSurfaceSpecs` | 面板画框；popover 影 | 页面关闭；不裁影 | 页面持有 | 统一边缘关系；设备待验证 |
| 阅读器 More | 原生 popup + `popover` 影（`ReaderControlPanel.ets:1580-1596`） | Reader · Control · `overlay` · `raised` · `{expand, dismiss, focus-return}` | popup spec；`ReaderSurfaceSpecs` | 原生 popup 画窗口；面板内容 | 原生 popup 关闭；不裁影 | 阅读器持有 | 统一边缘关系；设备待验证 |

### 4.5 模态

| 组件/区域 | 现状（代码事实） | 目标（域·标签·布局·表面·交互） | 参数 owner | 外框 / 影 | 遮 / 裁 | 显/关 · 触发 | 视觉候选 / 状态 |
|---|---|---|---|---|---|---|---|
| 书架/搜索/下载 native sheet | `bindSheet` 原生宿主；内容 `ReaderBoundedSurface` 只设宽度/底部 padding，不画第二框（`ReaderBoundedSurface.ets:64-69`、`BookshelfPage.ets:409-423`、`ReaderSearchFilterPanel.ets:112/265`、`ReaderSearchTaskPanel.ets:96/193`、`SharedDownloadPage.ets:891-894`） | App · Control · `overlay` · `modal` · `{block, dismiss, focus-trap, focus-return, keyboard}` | sheet spec；`ReaderSurfaceSpecs` | 原生宿主画纸底/圆角/裁剪；宿主影；内容零框 | 原生宿主画遮罩并裁 | 宿主页持有；identity/generation | 只能按宿主判边缘；内容零框正确 |
| `ReaderDialogSurface` + 宿主 | 卡片 `TOK_MESSAGE_SURFACE` + `TOK_MESSAGE_BORDER` + r12 + sheet 影；宿主负责 scrim/show-close（`ReaderDialogSurface.ets:37-53`、`ReaderDialogSurface.ets:94-112`） | App · Control · `overlay` · `modal` · `{block, dismiss, keyboard, focus-return}` | `DialogSpecId`；`ReaderSurfaceSpecs`；宿主 | 卡片自画框/影；宿主画遮罩 | 宿主遮罩；卡片圆角 | `CustomDialogController` 或自绘 overlay | 卡片不是 App 纸底；既有 |
| `JsonImportDialog` | 自绘 overlay + `app.scrim.import` + `ReaderDialogSurface`（`JsonImportDialog.ets`） | App · Control · `overlay` · `modal` · `{block, dismiss, focus-return}` | 自身 + dialog spec | 宿主画遮罩；卡片画框/影 | 宿主遮罩；卡片圆角 | 自绘宿主持有 | 遮罩角色与其它 modal 对照；视觉候选 |
| `LocalImportDialog` | 自绘 `app.scrim.warmModal` + `ReaderBoundedSurface` 进度/结果（`LocalImportDialog.ets`） | App · Message/Control · `overlay` · `modal` · `{block, dismiss, focus-return}` | 自身 + dialog spec | 宿主画遮罩；进度/结果画框/影 | 宿主遮罩；内容裁 | 自绘宿主持有 | 既有 |
| `BookRemovalDialog` | `CustomDialogController` + dialog spec（`BookRemovalDialog.ets:14`） | App · Control · `overlay` · `modal` · `{block, dismiss, keyboard, focus-return}` | 同上 | 卡片画框/影；controller 画遮罩 | controller 遮罩 | controller 持有；触发源页面 | 既有 |
| 来源切换抽屉 | `ReaderShell` 画 `TOK_SS_DRAWER_SCRIM`；`source-switch-drawer` 画顶部高光、顶部圆角、`clip(true)`、sheet 影（`ReaderShell.ets:378-396`、`ReaderBoundedSurface.ets:27-33`） | App · Control · `overlay` · `modal` · `{block, dismiss; focus-trap/return 待验证}` | `DrawerSurfaceSpec`；`ReaderSurfaceSpecs` | 抽屉面板画框/影；shell 画遮罩 | shell 遮罩；panel `clip(true)` | shell 持有；`sourceSwitchScopeId` | 行为待验证；既有 |
| 搜索历史展开 | 见 4.1；32% `app.scrim.modal`，结果 z2、header z4 | App · Control · `overlay` · `modal` · `{expand, dismiss, block, focus-trap, focus-return}` | 搜索表面 | 搜索表面画遮罩 | 结果裁切 | 搜索页 identity | 目标 modal；背景隔离/焦点/关闭恢复分别待验证，失败即契约未满足 |

### 4.6 消息与 Reader 边界

| 组件/区域 | 现状（代码事实） | 目标（域·标签·布局·表面·交互） | 参数 owner | 外框 / 影 | 遮 / 裁 | 显/关 · 触发 | 视觉候选 / 状态 |
|---|---|---|---|---|---|---|---|
| `ReaderTransientToast` | `TOK_MESSAGE_FEEDBACK` 深绿 + 边框 + 影；宿主优先级/身份/去重（`ReaderTransientToast.ets`） | App · Message · `overlay` · `raised` · `{transient, dismiss}` | message roles；宿主 | toast 自画框/影 | 无遮罩；自裁 | 消息宿主持有；原操作身份 | 不设全局顶层；既有 |
| `ReaderRecoveryNotice` | `TOK_MESSAGE_NOTICE` 深绿 + 影；页面 overlay；原操作未决前持续（`ReaderRecoveryNotice.ets`） | App · Message · `overlay` · `raised` · `{persist, press}` | message roles；宿主 | notice 自画框/影 | 无遮罩；自裁 | 页面/操作 owner 持有 | 不替代原操作状态；既有 |
| `ReaderPageState` | 页面/局部 loading、空态、失败/重试；无浮层外框 | App · Message · `in-flow` · `none` · `{passive, retry}` | 页面状态规格 | 内容自画；无浮影 | 无遮罩；页面裁 | 页面持有 | 既有 |
| Reader 正文 | `TOK_READ_SURFACE`、`TOK_READ_ELEVATED`、`TOK_LINE_STRONG`；正文主题独立 | Reader · — · `in-flow` · `page` · 既有阅读交互 | Reader 专用角色；`ReaderTypography` | 阅读器自画 | 阅读器裁 | 阅读会话持有 | 不迁 App 角色 |
| Reader 控制/目录面板 | `TOK_READ_SURFACE`、`TOK_READ_ELEVATED`、`TOK_LINE_STRONG`；r24/12/8（`ReaderControlPanel.ets`、`FullDirectoryPanel.ets`） | Reader · Control · `overlay` · `raised` · 维持既有交互 | Reader 专用角色；`ReaderTypography` | 阅读器自画 | 视面板 | 阅读会话持有 | 不迁 App 角色；仅对照边缘/影 |

## 5. 视觉候选项（不是结构结论）

以下现象不能单独证明结构错误；先进入 demo 对照，再决定是否迁移及具体 token。当前不修改生产代码。

| ID | 现象与已有证据 | 为什么不能直接判结构错 | 候选 | demo 要回答 | 涉及 token/owner |
|---|---|---|---|---|---|
| V1 | 昼间内嵌卡 `TOK_CARD_BG` L*96.3，纸底 L*94.2，ΔE≈2.18；边界对比 1.29–1.37 | 内嵌卡可以比纸底亮，只要边界/层级读得出来；亮度差接近 JND 不等于承载错误 | 降低边界强度，或改用更接近纸底的嵌入色，或保留亮卡但明确“内容卡”语义 | 长列表和滚动中，卡是“嵌在页面里”还是“浮在页面上” | `TOK_CARD_BG`、`app.border.contentCard` |
| V2 | 固定搜索面边界对比约 1.77–1.87，且 `fixed` 零影；底栏边界约 1.47–1.55 但带浮影 | 固定面不应靠阴影抬升；边界强不等于它应改成悬浮 | 降低固定面边界，或增加不构成抬升的顶部边缘/内高光 | 固定搜索面是否仍读成“附在页面顶部” | `app.search.panelBorder`、`app.border.control` |
| V3 | r18 同时出现在继续阅读卡、搜索面、浮动顶栏、下载顶栏/dock | 圆角是视觉语汇，不是承载关系的唯一证据；复用可能是有意的 | 按角色拆分圆角，或保留统一 r18 | 圆角是否帮助区分 embedded/docked/raised | `ReaderCardSpecs`、`ReaderHeaderSpecs`、下载/详情规格 |
| V4 | chip 使用 `TOK_CARD_BG` + `TOK_BORDER`，选中态深绿 | chip 填色本身不能证明它该透明或该悬浮 | 透明描边、控制填色或保持现状 | chip 在内容流中是否读成可操作控件而非卡片 | `TOK_CARD_BG`、`TOK_BORDER`、选中角色 |
| V5 | `ReaderSelectPanel` default/sourceGroup 用 `fixed` 零影；appearanceLibrary 用 popover | 下拉是否抬升取决于它和触发器的关系；子面板零影不代表最终窗口无边界 | 给 default/sourceGroup 选择 popover 影，或维持零影但加强边界 | 自绘下拉是否读成高于内容 | `ReaderSelectPanel.ets:166`、`POPUP_SPECS` |
| V5b | `ReaderInlineSelect` 用原生 `bindPopup`，`popupColor` 透明 | 最终边缘/阴影/遮罩由原生窗口画，不能只看子面板 | 统一 popupColor 与 raised 角色，或让原生窗口透明并完全由面板画 | 原生 popup 与自绘 popup 的最终边缘是否一致 | `ReaderInlineSelect.ets:53-56`、popup spec |
| V6 | 标准详情与书架 idle 已选 veil/三层/8vp 压栏；AppTopBar、下载头、漫画目录头保留 | 布局、材质与安全线各有 owner | 已定范围为 overlay·raised，其余仍按原角色 | 366 日间设计已确认；整页与设备验收分别记录 | HeaderSpecs、SurfaceSpecs、PageGeometry、各顶栏 |
| V7 | 固定面和悬浮面共用 `TOK_SURFACE_SOLID`；nav 另有 `floatingBorder` + 影 | 同色不等于同承载；边缘和影可以承担区分 | 保持同色，强化边缘/影差异；或拆独立悬浮 fill | 同底对照下是否仍能区分固定与悬浮 | `TOK_SURFACE_SOLID`、`app.navigation.floating*` |
| V8 | 夜间 `TOK_CARD_BG` 与 `TOK_SURFACE_SOLID` 都是 L*21.1，纸底 L*10.9 | 夜间层级可由边缘高光表达，不必靠亮度差 | 增加夜间边缘高光，或调整夜间 card/solid 亮度 | 夜间 embedded/docked/raised 是否可分 | 夜间 registry 角色 |
| V9 | 生产浮影是单层 20/8 12%；demo 用两层 2/4 8% + 8/20 12% | 影的参数是视觉候选，不是结构；生产与 demo 不同不证明生产错误 | 采用两层影，或保留单层 | 哪个影更接近“轻抬升”而不脏 | `app.navigation.floatingShadow`、elevation spec |
| V10 | 漫画下载 popup 用 `popupColor: TOK_CARD_BG`；内联 select 用透明 popup | 原生 popup 的最终边缘和系统合成只能在设备上确认 | 统一原生 popup 的填充/边缘策略 | 原生 popup 与自绘 raised 是否同一视觉族 | popup spec、原生宿主 |

V1–V10 不改变任何组件的布局/承载分类；例如 V4 的 chip 仍是 `none`，视觉调整不等于升级为 `embedded`。

## 6. Demo 与验证计划

### 6.1 静态 demo 范围

静态对比只回答：层级、边缘、包含、滚动尾部避让、断点分支和字体缩放后的几何。它不回答背景是否真的不可操作、焦点是否循环、关闭后是否回到触发源。

| 维度 | 取值 | 目的 |
|---|---|---|
| 宽度 | 320、366、600、840vp | 320/366 是手机档；600 是展开断点；840 覆盖 rail/popover 分支 |
| 高度 | 640（手机）、1000（平板） | 长列表、dock、header、modal 的包含 |
| 主题 | day / night | 夜间边缘和填色对照 |
| 字体 | 1.0 / 1.6 | 搜索 52 基准的缩放、顶栏和弹层包含 |
| 内容状态 | 长列表、底部 dock、固定/浮动顶栏、下拉、底部 sheet、模态、历史展开 | 覆盖实际承载关系 |
| 检查项 | computed background/border/radius/shadow/z-index/clip；最后一行是否被 dock 遮住；header `startInset`；rail 是否压内容；popover 是否在安全区内；文本是否溢出 | 静态视觉与几何 |

已有证据：工作区 `docs/ui-design/demos/reader-warm-surfaces-demo-20261028.html` 覆盖 366/100% 与 320/160% 的典型层级、包含和历史/阅读弹层，PASS；但它只证明 demo 本身。本轮在该 demo 上补 600/840、night、1.6，不新建第二套色板。夜间、600/840 平板和 rail/popover 分支未覆盖，记 OPEN。

### 6.2 交互验证（与静态分开）

参照 W3C modal dialog 模式，至少验证：

- 背景隔离：modal 打开后背景不可点击、不可聚焦；搜索历史遮罩是否真正阻断背景。
- 搜索历史目标：`modal + block`；背景隔离、焦点约束、关闭恢复分别记录，验证失败表示契约未满足，不自动改判为非模态。
- 焦点：初始焦点、Tab/Shift+Tab 循环、Escape 关闭、关闭后回到触发源。
- 破坏性确认：防止误触确认，但保留显式取消；不得用自动聚焦危险按钮替代取消。
- 原生/自绘宿主：`bindPopup` 的 `autoCancel`、`bindSheet` 的关闭回执、自绘遮罩的点击关闭。
- 滚动：dock 的 `endInset/nativeEndInset` 使最后一行可读；header 的 `startInset` 不压第一行。
- 身份：旧 generation/identity 的回调不能操作新页面；消息宿主去重和退休。
- 字体：1.6 倍下弹层、顶栏、chip 的可点击区域和文本包含。

交互验证不能用静态 demo 的 PASS 代替；浏览器 demo 也不能证明 HarmonyOS native sheet/popup 的最终遮罩、边缘和焦点。

### 6.3 验证边界

| 问题 | 静态 demo | 交互验证 | 设备像素 |
|---|---|---|---|
| 层级/边缘/包含 | 是 | 否 | 原生宿主最终边缘需设备 |
| 背景隔离 | 否 | 是 | 是 |
| 焦点循环/关闭恢复 | 否 | 是 | 是 |
| 滚动尾部避让 | 可看几何 | 实际滚动 | 是 |
| 字体缩放 | computed 几何 | 实际输入/点击 | 是 |
| 原生 popup/sheet 遮罩与边缘 | 否 | 部分 | 是 |

设备像素与交互验收仍 OPEN。上一轮设备截图的前台不是 Reader，已删除临时文件，没有启动 Reader，也没有把他人页面当作本应用证据。

## 7. 迁移状态与决策门

### 7.1 已实现，不再当作待办

- 底栏/rail、详情 dock、下载 dock 登记为 `overlay · raised`，已接统一三层绘制；原材质、尺寸与内容尾部避让保留。自然高度的原样生产子组件已由原生隔离宿主复核，整页/设备另验。
- `ReaderSurfaceSpecs` 已拥有 elevation 以及 Drawer/Dialog/Sheet/Popup 规格；颜色仍在 registry。
- 内嵌卡、未迁移固定顶栏、历史 `popover`、native sheet 内容零框和 Reader 专用角色隔离保留；书架 idle 与标准详情使用 veil/raised。
- 覆盖避让由 `ReaderPageGeometry` 提供，header 的 overlay 绘制与 `startInset` 并存。
- 来源切换当前走 `source-switch-drawer`（`ReaderShell` scrim + `DrawerSurfaceSpec`）；`source-switch-window` popup spec 是 legacy/unused，不按当前浮窗评审。

### 7.2 待 demo 决定

- V1–V10 中未在本轮明确选定的视觉候选仍待 demo 决定；标准详情/书架 idle 的 veil/raised 与统一浮影已按 366 日间定稿接入源码。
- 搜索历史目标已定为 `modal + block`；背景隔离、焦点约束、关闭恢复分别记录，验证失败即契约未满足，不改判为非模态。
- 原生 popup/sheet 的最终边缘：需在设备上确认，不能由子面板或浏览器 demo 推断。
- 平板 600/840 的 rail/popover 分支：需静态 demo 补图。

### 7.3 结构修复的准入（示例，不是封闭清单）

结构问题的判定不以“是否好看”为准，也不要求所有 overlay 都预留布局。至少包括：

- 常驻导航、工具带、dock 或固定 header 遮挡内容，且没有通过 `startInset / endInset / nativeEndInset` 避让或登记例外；
- 同一承载关系画了第二个外框；
- 遮罩、裁剪、显隐/关闭、触发源没有明确 owner；
- 原生宿主和内容同时画外框/影；
- 模态/抽屉打开后背景仍可点击或可聚焦（背景误触/指针穿透）；
- 焦点逃逸、焦点循环失败，或关闭后未回到触发源；
- 旧回调、旧 generation/identity 操作新页面；
- 常驻内容被永久遮挡或无法到达；
- 组件绕过 registry 或 `ReaderSurfaceSpecs` 写死颜色/阴影/圆角。

临时菜单、下拉、popup、sheet 和模态允许临时覆盖内容，不因覆盖本身构成结构问题；只有常驻 chrome 的遮挡需要布局避让。

圆角、亮度、chip 填色、单层/双层影本身不满足结构修复准入；但背景误触、焦点逃逸、旧回调越权是结构问题，不能只当视觉候选。

### 7.4 token 迁移顺序（若 demo 通过）

1. 先改 `Reader-UI/theme/registry.json` 的颜色角色；
2. 由生成器同步 `ReaderThemeRegistry.ts`，不手改生成物；
3. 由 `ReaderSurfaceSpecs` 调整 elevation/规格；
4. 由 `ReaderPageGeometry`、`ReaderHeaderSpecs`、`ReaderSearchControlGeometry` 调整几何/缩放；
5. 只跑本次实际变更需要的最小验证，不扩大到全量业务、HAP 或设备。

## 8. 未决与 NOT_RUN

- 平板 600/840 的 rail/popover 静态 demo：NOT_RUN。
- 平板 1.6 倍字体包含：NOT_RUN。
- 夜间层级对照：NOT_RUN（现有 demo 未覆盖）。
- 生产 modal 背景隔离、焦点循环、Escape、关闭恢复：NOT_RUN（demo 的历史焦点修正只证明 demo）。
- 搜索历史 `modal + block` 契约（背景隔离/焦点约束/关闭恢复）：NOT_RUN；失败即未满足，不改判非模态。
- 背景误触、指针穿透、焦点逃逸、旧回调越权：NOT_RUN。
- 底栏/rail、详情/下载 dock 的 `raised` 角色已登记；抬升强度仍由 demo 对照，不再回退为 `docked`。
- 原生 `bindPopup` / `bindSheet` 的最终边缘、遮罩和系统合成：OPEN，需设备像素。
- V1–V10 的迁移决定：OPEN，待 demo。
- 生产代码、主题 token、版本、HAP、HDC、设备状态：本文件未改动。

## 9. 结论

当前结构（z 序、避让、宿主分离）基本正确；主要问题是材料编码和视觉语汇在多个消费者之间不统一。v3 先把域、标签、布局、表面和交互拆开，把“覆盖”与“抬升”拆开，把“结构错误”与“视觉候选”拆开，并把每个组件的绘制宿主和触发源登记清楚。下一步只做静态 demo（320/366/600/840、day/night、1.0/1.6）与独立交互验证；demo 通过后再决定 V1–V10 是否迁移及具体 token。
