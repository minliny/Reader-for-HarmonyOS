# UI 整体方案附件：公共组件库存与采用决定（2026-11-05）

本附件把整体 UI 方案落实到当前 `entry/src/main/ets/features/common/` 的 **87 个实际文件**。生产源码基线为 `663c6ee59e65b6a6afe2d9fa4bb18919a63cbabe`；消费者经当前 import 与调用核对，表内列代表性实际消费者，不以引用次数代替生产覆盖。此次仅编写方案，不修改生产代码，不创建运行时空壳，不运行测试、构建、签名或设备操作。

配套文件：[总提案 §15](ui-target-architecture-20261105.md#15-实施设计总表与复用裁定)、[实际模块附件](ui-plan-modules-20261105.md)、[页面迁移附件](ui-plan-page-migration-20261105.md)、[UI 参数契约](ui-parameter-contract-20261025.md)、[表面角色契约](ui-surface-role-contract-20261028.md)、[消息框架](../message-ui/FRAMEWORK.md)。此次问题记录是 FnOS 外部证据 `/vol2/1000/Codex/Reader/Reader-for-HarmonyOS/docs/issues/ui-architecture-audit-20261105.md`，尚未同步为本地文件，不作为已存在的本地链接。既有契约中的完成标记不替代本附件的消费者和 gap 核验。执行只进入工作区唯一待办的 UI00–UI06，本附件不另建执行状态总账。

## 1. 决定含义与来源

| 决定 | 本附件中的准确含义 |
| --- | --- |
| DIRECT | 在表中限定的职责上直接复用已经存在的平台/Reader 能力，不新增相同算法或运行时。它不表示所有消费者、视觉和设备证据已经通过。 |
| ADAPT | 复用现有能力和文件，补足 Reader 语义、组合、平台接线或消费者迁移；保留的自有代码须限于已说明的适配边界。 |
| KEEP | 保留必要的 Reader 业务/专用展示职责；仍承担主题、度量、无障碍、动效、消息和生命周期公共义务。 |
| RETIRE | 已选定后继职责；达到本行退役条件后删除旧生产实现及兼容出口。此状态是计划，不能现在删文件或删测试，也不能永久保留两套完整分支。 |
| REFERENCE_ONLY | 仅采用已核对的架构事实和交互分类，不导入该应用的源码、样式或资源。 |
| DEFER | 当前没有生产消费者，或替代能力尚未证实；保留明确 gap 和复评条件，不计为已接入，也不因本方案开放入口。 |

| 来源代号 | 已核对来源与使用方式 |
| --- | --- |
| N | 当前工程已使用的 ArkUI/系统能力：Button、Toggle、TextInput/TextArea、Row/Column/Stack、List/Grid/Scroll、测量、焦点/语义、动画、bindSheet/bindPopup、原生确认等。实施时先按项目实际 SDK 声明与需求语料确认完整覆盖；完整覆盖即优先直接采用。未确认的 Select、分段选择、modal、阴影等能力进入第 3 节 gap。 |
| N-A | 官方高级组件候选，文档固定 `openharmony/docs@f41b9345badd47c7ab0c263344cd7f4b5a549afb`：[ComposeTitleBar](https://github.com/openharmony/docs/blob/f41b9345badd47c7ab0c263344cd7f4b5a549afb/zh-cn/application-dev/reference/apis-arkui/arkui-ts/ohos-arkui-advanced-ComposeTitleBar.md)、[ComposeListItem](https://github.com/openharmony/docs/blob/f41b9345badd47c7ab0c263344cd7f4b5a549afb/zh-cn/application-dev/reference/apis-arkui/arkui-ts/ohos-arkui-advanced-ComposeListItem.md)、[SegmentButton](https://github.com/openharmony/docs/blob/f41b9345badd47c7ab0c263344cd7f4b5a549afb/zh-cn/application-dev/reference/apis-arkui/arkui-ts/ohos-arkui-advanced-SegmentButton.md)。本地 `build-profile.json5:6-7` 的 compatible/target 均为 `6.1.0(23)`；API24/26新增能力不能计作当前可用，未来版本仅规划。 |
| R | 当前 Reader 实现，作为薄适配和业务组合起点；不因已有代码而自动准许保留与平台/成熟开源重复的通用算法。 |
| U | 工作区受控源 `Reader-UI/theme/registry.json`、`Reader-UI/theme/ReaderThemeSelection.ts` 及已批准的 design/demo 数据。生成副本从权威源更新，不手改生成值。 |
| O1 | ReadYou `d2b979ccad9a3e54b9499929a9dc2824578b0fd9`，GPLv3；[Theme.kt](https://github.com/ReadYouApp/ReadYou/blob/d2b979ccad9a3e54b9499929a9dc2824578b0fd9/app/src/main/java/me/ash/reader/ui/theme/Theme.kt)、[FeedbackIconButton.kt](https://github.com/ReadYouApp/ReadYou/blob/d2b979ccad9a3e54b9499929a9dc2824578b0fd9/app/src/main/java/me/ash/reader/ui/component/base/FeedbackIconButton.kt)、[adaptive 页面](https://github.com/ReadYouApp/ReadYou/blob/d2b979ccad9a3e54b9499929a9dc2824578b0fd9/app/src/main/java/me/ash/reader/ui/page/adaptive/ArticleListReadingPage.kt)。REFERENCE_ONLY：平台控件加薄适配、主题根注入、自适应承载分工。 |
| O2 | Readest `c46730772847d5d551e73aa1b2adebff339f634c`，AGPLv3；[SettingsRow 家族](https://github.com/readest/readest/tree/c46730772847d5d551e73aa1b2adebff339f634c/apps/readest-app/src/components/settings/primitives)、[SegmentedControl](https://github.com/readest/readest/blob/c46730772847d5d551e73aa1b2adebff339f634c/apps/readest-app/src/components/SegmentedControl.tsx)、[BooksGrid](https://github.com/readest/readest/blob/c46730772847d5d551e73aa1b2adebff339f634c/apps/readest-app/src/app/reader/components/BooksGrid.tsx)、[主题](https://github.com/readest/readest/blob/c46730772847d5d551e73aa1b2adebff339f634c/apps/readest-app/src/styles/themes.ts)。REFERENCE_ONLY：语义行、主题域、chrome/引擎组合边界。其 DESIGN.md 明确仍在迁移，不能照单继承其双按钮系统和外观逃逸。 |
| O3 | Readest 固定的 `foliate-js` gitlink `c14f30c83003ca05b9d2fd95148eff5bda9605df`，[MIT LICENSE](https://github.com/readest/foliate-js/blob/c14f30c83003ca05b9d2fd95148eff5bda9605df/LICENSE)、[view.js](https://github.com/readest/foliate-js/blob/c14f30c83003ca05b9d2fd95148eff5bda9605df/view.js)。DEFER：Web/WebView 引擎候选，依赖 DOM/HTMLElement；未证明覆盖 Reader 位置、格式与资源合同，不作为此次 ArkUI 组件替代。 |

**ArkUI 完整控件优先**：若平台控件已完整承担命中、焦点、键盘、语义、禁用及值控制，Reader 只传主题/内容和原 owner 回调；不能在旁边用 Text/Stack 重做同类控件。GPL/AGPL 应用仅参考架构。MIT/Apache 许可与跨语言、跨渲染树、跨数据协议的可运行性分别核验；许可允许不等于 DIRECT，更不等于完整业务替代。

### 1.1 高级组件的具体采用边界

| 官方候选 | 当前文档已证明的能力 | 对 Reader 的具体差距与采用决定 |
| --- | --- | --- |
| `ComposeTitleBar` | 接受item/title/subtitle/menuItems；item及菜单项的声明类型有action/isEnabled及API18无障碍文本等能力。 | **DEFER具体替代路径**，按总提案G-TITLE裁决：先核对左项公开action能否转交现用返回/保存退出owner；没有名为Reader onBack的参数不构成不适用证明。再逐用途核对字体、焦点、测量、搜索形变、受控veil/material和尾槽。普通标题路径完整覆盖则必须采用；已证明不足的特殊路径只用公共原生动作/文字与有限几何/材料适配。通用属性按项目SDK包装规则核对，不通过隐藏修改内部节点补接口。 |
| `ComposeListItem` | contentItem提供图标与主/次/说明文字，operateItem有arrow/icon/button/switch/checkbox/radio/text等有限结构；选中状态和onChange可传。 | **ADAPT候选，尚未运行验证**，按G-ROW裁决：核对整行与内部动作owner、enabled/busy、原实体回调、Reader字体/主题、大字和多行约束。满足的导航/布尔/信息行采用；不满足的明确行型只用平台布局和原生控件薄组合，不复制List算法。不能把有switch字段等同于业务写入已确认。 |
| `SegmentButton` V1 | tab/capsule、选项、颜色/字号/字重及选择下标；`selectedIndexes`为`@Link`，内容自适应但默认最小高度28vp。V1文档不支持设置字体类型，这一限制不能推广到V2。 | **ADAPT候选**，按G-CHOICE裁决：以临时selectedIndexes桥映射稳定业务value，原owner回传才是接受事实；核对44vp实际目标、Reader字体和字号合同。不用API24的enableStateAnimation或其他24/26增强假称API23已覆盖；不能通过压制系统字号补不足。需同时比较V2，不因V1缺项预先决定自研。 |
| `SegmentButtonV2` | API18起提供Tab/Capsule单选与MultiCapsule多选；API23范围内包含受控选择及回调、item.enabled、TextModifier、itemMinHeight、padding和背景等公开能力。 | **与V1并列的ADAPT候选**：单选用途保持单选语义，以稳定ID映射下标，拒绝或未知时继续投影原owner接受值；不以原生选择动画当保存成功。核对TextModifier字体、实际命中范围、选中外框与未选背景；Text边框不自动等于整项按钮边框。布局、交互、辅助语义与身份合同完整覆盖则采用，否则仅保留该用途已证明需要的有限适配。 |

## 2. 目标公共家族和扩展边界

下列是职责模块，不要求现在创建目录、注册器或空组件。先在现有文件实现完整消费者，再按职责整理文件。

| 家族 | 实际公共责任 | 原 owner 保留的责任 |
| --- | --- | --- |
| `foundation.theme/text/icon/surface` | App/阅读主题域、语义 token、字体加载与文字角色、资源身份、表面层级、焦点/按压状态 | 用户主题选择/备份的事务、书籍阅读配色内容和业务状态 |
| `foundation.environment/geometry` | 窗口事实、单位、width class、字号、键盘/安全区；统一页面/浮层几何和测量回报 | feature 锚点、原生滚动位置、列表数据、阅读排版 |
| `controls.action/choice/field/search` | 单一交互语义、真实原生控件、受控值、可用性、稳定选项 ID、44vp 目标布局、焦点/键盘/语义、文字增长 | 原操作准入、持久化、重试、取消、路由决策 |
| `patterns.row/card/collection` | NavigationRow、ActionRow、ToggleRow、ChoiceRow、FieldRow、InfoRow；标题/说明/分隔线/图标盒；普通 Card/Section 外框、列表状态 | 书籍/来源/章节/任务的内容组合、虚拟化数据源与实体身份 |
| `chrome.page/navigation/bar` | PageScaffold/StandardPage、主导航占位、TopBar/BackBar/SearchBar/SelectionBar、底部操作栏、滚动避让、测量 | 页面业务、阅读/漫画专用手势和渲染 |
| `presentation.menu/sheet/dialog` | 依承载关系提供菜单/浮层/面板/确认外框、标题/动作区、原生宿主适配、遮罩、焦点恢复、键盘避让和展示身份 | 业务确认结果、未决写入、任务/编辑状态 |
| `messages.state/feedback/recovery` | 已登记消息分类、统一呈现和宿主寿命；无内容失败与有内容恢复分别表达 | 业务事实、generation、原 owner 的继续/重读/重试 |
| `foundation.motion` | 原生动画执行、语义时长、减少动态效果、统一时钟、结束/取消/反向合同 | 阅读形变/翻页/会话启动等已批准的业务展示编排 |

一个组件必须同时声明：语义；输入事实和稳定 ID；输出意图；外框/区域所有权；几何/长内容；角色/焦点/键盘/状态；失效/清理；真实消费者和验收证据。`primary` 只表示动作强调，`selected/checked/value` 单独表达选择。普通内容 slot 只容纳业务内容，不能重新拥有边框、标题区、按钮目标或遮罩；trailing 优先使用已登记的 icon/chevron/badge/action/choice/field 类型。新增有限变体要有语义或布局原因，不再按页面名复制历史物理 tuple，不开放任意 color/radius/height/styleBag。

### 2.1 一个页面实例只有一个装配与测量 owner

继续使用现有 `resolveReaderPageGeometry` 及同一套 `ReaderPageGeometryInput → ReaderPageGeometry` 输入/输出合同。需要收口的是同一页面实例内竞争的输入来源、测量采纳和重复外框，而不是将合法的纯函数、类型、宿主文件全部压成一个组件。两条现有承载路径分别明确 owner：

| 路径 | 装配与测量归属 | 公共执行与内容边界 |
| --- | --- | --- |
| 普通 Scroll 页面 | `ReaderStandardPage` 接受宿主真实宽高，合并导航占位、头尾测量、键盘/安全区等输入，拥有该实例测量记录与layout identity，调用既有resolver形成一份解析快照。`MainTabShell`在此分支只提供导航输入并观察视口回报，不并行求解。 | 同一只读快照交给Scaffold、PageScrollHost、头尾和overlay；原scroller及业务content保留，不接受另一份外部geometry与内部结果竞争。 |
| 原生List/Grid、书架搜索、阅读/漫画等专用内容 | 由该页面现有具名领域适配器持有测量与装配，使用同一输入类型、同一个resolver；不得再由父壳保存另一份可写输入或覆盖其结果。 | 同一只读快照同时到达Scaffold与原生body/overlay。保留原List/Grid/viewport、锚点、会话和高频采样；不强套StandardPage/Scroll，不创建新导航或测量运行时。 |

`ReaderPageScaffold`负责已解析快照的布局绘制与测量回报；`ReaderFixedHeaderHost`只测量/绘制固定头，`ReaderPageScrollHost`只执行原生滚动避让。`ReaderPageShell`、`ReaderFrameStyle`及水平几何模块可继续作为有实际消费者的纯策略/类型；每页只有一个owner组合它们。多个文件或入口本身不是重复实现，只有竞争装配、复制算法和同层重复框需要退役。一次有效输入更新后的内容、头尾、滚动与覆盖层共享同一快照，旧layout identity的回执不能更新新实例。

### 2.2 依赖方向的实测基线与约束

按生产基线的直接相对import核对，common反向导入其他feature不是笼统“4处”，而是以下 **6个源文件、11条source→target边/导入声明、17个符号绑定**：

| 源文件与行 | 目标 | 边 / 符号绑定 |
| --- | --- | --- |
| [MotionSpec.ets:4](../../entry/src/main/ets/features/common/MotionSpec.ets#L4) | source/SourceSwitchVisual；manga/MangaDirectoryVisual；reading/ReaderPanelMotionContract | 3 / 3 |
| [PageBackBar.ets:1](../../entry/src/main/ets/features/common/PageBackBar.ets#L1) | manga/MangaDirectoryVisual；manga/MangaDirectoryPressFeedback | 2 / 5 |
| [ReaderMangaDownloadPopup.ets:3](../../entry/src/main/ets/features/manga/ui/ReaderMangaDownloadPopup.ets#L3) | manga/MangaDownloadOperationsPanel；manga/MangaDownloadActionsGateway | 2 / 3，其中2个type-only绑定 |
| [ReaderSearchField.ets:2](../../entry/src/main/ets/features/common/ReaderSearchField.ets#L2) | manga/MangaDirectoryPressFeedback；manga/MangaDirectoryVisual | 2 / 4 |
| [ReaderSurfaceSpecs.ets:4](../../entry/src/main/ets/features/common/ReaderSurfaceSpecs.ets#L4) | source/SourceSwitchVisual | 1 / 1 |
| [ReaderTypography.ets:14](../../entry/src/main/ets/features/common/ReaderTypography.ets#L14) | manga/MangaDirectoryVisual | 1 / 1 |

`ReaderMangaDownloadPopup`是应回归漫画feature的业务组合；迁出后基础层仍有 **5个文件、9条边**。另有common→app的 **17条导入声明**：15条指向`ReaderWindowCoordinator`，各1条指向`ReaderFontLoadHost`、`ReaderRecoveryProjection`，须按环境、字体能力和业务投影分别裁定。`ReaderTypography.ets:13 → ./SharedDownloadVisualSpec.ts`的`DOWNLOAD_VISUAL`虽然处于同目录，仍是下载领域数据依赖。改名、搬进ui、alias或barrel转发不证明职责已纠正。

UI-01将上述事实落实为有限的临时债务登记：逻辑owner、真实目标/导出符号、type/value、保留理由及退出消费者/批次。剩余集合须为上一已接受集合的子集，已消除依赖不得复活，不能仅维持总数再换入新边；基础层最终不依赖feature实现。搬回正确领域的组合可按职责退出基线，但把领域数据改放公共目录不能据此清零。

### 2.3 用现有检查守住消费者与退出条件

本附件已经逐行列消费者与退役条件，需要补强的是其实施约束。87项各自按“现有导出→目标职责/公开合同→全部真实消费者→必要参数/行为证据→被替代入口清零”闭环；包括受公共API影响的关闭/保留源码。`ADAPT/DIRECT`可按消费者合并或内部化，不强制保留所有文件，也不要求全删。Core/业务owner、字体/资产、用户数据协议等无本轮删除理由时继续保留；合法纯策略/类型不因多文件而被当成重复。每种语义只有一个交互/外框权威实现，允许有限具名变体和有依据的领域组合，不能把动作、选择和专用手势强制变成一个万能控件。

UI-01须在现有源码检查选择路径登记必要的依赖方向与公共API检查，复用实际ArkTS类型检查和[共享producer输入检查](../../tools/lib/shared-producer-inputs.mjs)。后者只核对实际调用、已声明字段及未知/重复/spread输入，**不证明类型或值已传播到绘制**；仅AST字段名、import或transpile成功均不足。新增/修正合同要在当前可见消费者验证声明与调用类型一致、占位/宽高/回调到达resolver及实际内容/头尾/overlay，包含错误Props类型、漏传rail/tail、丢失height、重复owner、重复框和旧测量回执的失败反例。现有管理页button样本不替代可见设置/来源消费者。

方向检查要识别import、re-export、type-only、动态导入和alias的最终目标，防止新增feature反向依赖或经转发绕过有限债务登记；无法解析的跨层目标保留待裁定，不能默认为通过。公开API与实际consumer/退役检查复用现有具名`--tests/--cases`、case/resource来源登记及相关反例，不新建检查框架或默认全量门禁；轻量规则可按实际变化接入既有源码/构建/CI路径。本次仅补充方案，尚未实现这些检查、登记或CI接线，也没有运行产品检查。

## 3. 必须先回答的能力 gap

这些是总提案 §15.3 的决策输入明细，本附件没有执行 SDK 探针或验证，不单独维护状态。对应关系为：G-C1/C4→G-ACTION，G-C2/C3→G-CHOICE，G-C5→G-ROW；G-L1是每页唯一装配/测量与共同几何合同，导航占位同时受G-NAV约束；G-L2及高级标题栏采用受G-TITLE约束；G-O1/S1→G-SURFACE。G-M1/G-X1是相应工作包的机制/采用明细。每项由唯一待办 UI00–UI06 收口，使用本次刚需的最小范围，不能自动扩展成全量门禁。

| Gap | 要回答的具体问题与最小证据 | 决策影响 |
| --- | --- | --- |
| G-C1 原生动作 | 以书源检测/登录、搜索动作、底部主次动作验证 ArkUI Button 的受控 enabled/busy、真实 44vp 占位、定制内容/主题、键盘/焦点和旧 owner 失效；先读实际 SDK 与当前原生 Button 消费，再做必要单控件探针。 | 能完整覆盖即原生 Button + 薄适配；不得继续 Text/Stack 按钮。视觉目标小于44时由父布局预留目标，不用重叠响应区掩盖。 |
| G-C2 原生布尔/互斥选择 | 用书架自动更新、通用设置、封面/列表和 App 主题确认 Toggle/Radio及N-A SegmentButton的受控值桥、label、checked/selected、组/项禁用、44vp和字号增长；具体字体类型缺口见§1.1，不预设高级组件完整可用。 | 完整覆盖则采用；ReaderSegmentedControl 只保留不能由平台承担的有限呈现适配，书架设置旧 native/自画分支都迁向同一合同。 |
| G-C3 原生 Select | 对书源分组、工具检测模式/深度、下载筛选证明当前 SDK Select/原生popup宿主能否同时覆盖自适应、锚点边界、长选项、键盘、selected/expanded、禁用与身份。 | 完整原生选择器优先；缺失能力须按失败样本登记，ReaderSelect 家族只补缺失，不再复制整套通用选择算法。 |
| G-C4 字段/表单 | 核对 TextInput/TextArea 的 label 关系、密码/数值/URL、多行、submit、验证消息、键盘/焦点；用来源JSON编辑和阅读内容搜索核对实际需要的控制器与会话寿命。 | 保留原生输入；新增的 FieldRow/Hint/Error 只组合呈现与关联，不拥有draft/校验事务。 |
| G-C5 语义与集合 | 以N-A ComposeListItem核对CategoryRow导航/开关/操作、选中行与信息行；确认enabled/busy/Reader字体、整行/内部动作归属和语义；目录/书架/下载保持当前List/Grid/LazyForEach/Repeat数据与滚动。 | 完整覆盖的行采用高级组件；差距限定到具体行型的薄组合。不把所有行强制button，也不把原生虚拟化替换成公共大Scroll。 |
| G-L1 壳合同与传播 | 声明并透传真实width/height、rail占位、tail预算及viewport回调；普通Scroll由StandardPage拥有测量/装配，MainTabShell在此分支只供导航输入；专用内容由原具名适配器以同一Input/Output合同调用现有唯一resolver。实际内容/头尾/overlay须消费同一快照，并证明旧测量失效。 | 不以增加三个Props即结案；以漏传、错误类型、丢height、重复owner/框等反例独立验收，再迁依赖页面。保留原生List/阅读宿主，不强套万能页面或Scroll，不用固定高度绕开。 |
| G-L2 字号和主题 | 对标题、SectionHeading、分段、选项、表单、sheet动作核对真实字体度量/静态字面和系统缩放；对N-A ComposeTitleBar逐路径核对返回/溢出/veil/形变/测量差距；明确App与阅读域role，不用强行限制字号代替适配。 | 普通路径完整覆盖则采用高级标题栏；特殊路径只保留已说明的原生组合适配。退役页名字体别名和固定文字盒须先有真实后继；Reader-UI生成内容从权威源更新。 |
| G-O1 原生modal | 对原生sheet/dialog/popup确认安全区/键盘、嵌套返回、焦点恢复、拖动取消、关闭动画body保留、原展示失效。 | 原生宿主完整覆盖则直接用；外框适配不能成为第二个modal管理器，禁止新建万能Overlay运行时。 |
| G-S1 表面/阴影 | 比较当前SDK原生shadow/material与已批准三层悬浮表面的边缘、透明内区、裁剪和密度表现。 | ReaderRaisedSurface当前保留必要绘制；完整覆盖后退役Canvas caster，不能事先认定原生缺失或自绘永久合理。 |
| G-M1 动画机制 | 核对原生动画/Animator能否覆盖同采样点反向、seek、重定向、销毁及0时长完成；对照 MotionTimeline/PointTrack 真实消费者。 | 完整覆盖即替换通用采样实现；Reader保留有限的已批准轨道/阶段与业务身份，未证明前不扩建通用动画引擎。 |
| G-X1 未接入/外平台 | 确认无消费者文件和关闭模块的意图；外平台库按许可、运行环境、格式语料、位置/书签迁移、脚本/资源访问与失败恢复逐项评估。 | 维持 DEFER/REFERENCE_ONLY；不以一次文档采用决定开放模块或替换阅读引擎。 |

## 4. 当前 common 全库存逐文件决定

路径均相对 `entry/src/main/ets/features/common/`。消费者路径相对 `entry/src/main/ets/`；`→` 表示通过该公共组件间接到达的实际链。`[保留]` 是保留/关闭/无可见入口分支，不计当前生产覆盖；`[开发]` 只计明确开发入口。全部“退役条件”均是未来实施条件。

### 4.1 主题、文字、图标与表面基础（10）

| 当前文件 | 目标公共家族/模块 | 来源 | 决定 | 必要适配 | 真实消费者 | 退役条件 |
| --- | --- | --- | --- | --- | --- | --- |
| `ReaderThemeRegistry.ts` | foundation.theme：语义role/阅读主题注册 | U：Reader-UI registry；R | DIRECT | 保持受控生成、App/阅读域和role查找，不引入第二主题引擎；消费扩展按G-L2 | ReaderThemeHost、WindowCoordinator及现有公共/feature组件 | 仅经权威源模式迁移并保留既有主题ID/恢复合同后替换副本；当前无退役 |
| `ReaderThemeSelection.ts` | theme业务选择/备份协议，置于UI适配边界之外 | U：Reader-UI同名源；R | KEEP | 保持四个逻辑选择、历史ID迁移和事务；公共控件只提交意图 | app/ReaderThemeHost、reading/ReaderAppearanceState | 用户数据协议有明确后继和迁移证明后；本轮不改 |
| `ReaderTokens.ets` | foundation.theme/surface：语义token门面 | R/U；N资源 | ADAPT | 区分role与布局常量；逐项对照Registry，取消重复权威和页名别名扩散 | Settings、Bookshelf、Source、Reading等；公共组件 | 全部旧导出有语义后继且消费者迁完后逐别名退役 |
| `ReaderLayoutTokens.ts` | foundation.environment：设计约束常量 | R；N布局 | ADAPT | 仅保留设计间距/目标下限/宽度约束，内容高度交给实测；G-L1/L2 | FloatingBarMetrics、PageShell、Typography | 旧固定几何不再参与生产计算后逐项退役 |
| `ReaderFontFamilies.ts` | foundation.text：注册字面身份 | R；N字体；既有字体许可 | DIRECT | 复用现有静态/变量字面身份，显示/测量使用同一字体；G-L2不计已通过 | ReaderFonts、Typography、详情/目录/阅读测量 | 字体资源与注册身份完整迁移后；不因外观整合删字体 |
| `ReaderFonts.ets` | platform.text：原生字体注册适配 | N字体；R资源映射 | DIRECT | 保留幂等注册和真实加载结果，不自写字体渲染/加载引擎 | EntryAbility、公共Select、各实际页面/阅读宿主 | 原生注册入口有等价后继且所有宿主完成迁移后 |
| `ReaderTypography.ets` | foundation.text：角色与测量合同 | R；N文本度量 | ADAPT | 收敛body/label/title/meta/action等语义；区分阅读正文与UI；SharedDownload数据反向依赖迁回对应feature；G-L2 | 所有公共文字及书架/搜索/设置/阅读/下载 | 每个旧页名/compat别名有消费者映射和字号证据后逐项退役 |
| `ReaderMessageStyle.ets` | messages.text：框架文字角色 | R既有消息规范；N Text | ADAPT | 继续统一消息字体，与Typography同源；保持现有分类，不能再按页面自定义同类消息 | PageState/Recovery/Dialog/Toast及任务专用宿主 | 重复文字tuple只在公共角色替代并迁完后退役 |
| `ReaderActionIconResources.ets` | foundation.icon：语义动作资源映射 | R既有图标/来源登记；N Image | DIRECT | 保留day/night资源、来源/哈希/许可；只输出资源，按钮语义由控件提供 | BookshelfMoreActionSheet、MultiSelect、下载/漫画ActionSheet | 精确资源及语义ID后继可审查后；不随控件迁移重生成图标 |
| `ReaderScrimColor.ets` | foundation.surface：有限遮罩颜色适配 | R；N颜色能力候选 | ADAPT | 复用已有有效不透明颜色适配；先核对N完整覆盖再决定是否替代，禁止另加通用色彩算法 | BookshelfPage/Shell、SearchFilter/TaskPanel、SharedDownloadPage | 平台颜色合成完整覆盖已登记样本后删除旧适配分支 |

### 4.2 窗口、布局、页面与顶栏（22）

| 当前文件 | 目标公共家族/模块 | 来源 | 决定 | 必要适配 | 真实消费者 | 退役条件 |
| --- | --- | --- | --- | --- | --- | --- |
| `AppTopBar.ets` | chrome.bar：home标题语义 | N布局/文本/动作；N-A ComposeTitleBar候选；R | ADAPT | G-TITLE先裁决普通标题路径；统一外框、标题测量/动作槽/字号/语义；与BackBar共享bar底座，保留home语义 | shell/SettingsShell；[保留] DiscoverPage | 现有home外框被同一家族所有消费者替代后退役重复实现 |
| `PageBackBar.ets` | chrome.bar：back/detail/navigation语义 | N按钮/布局；N-A ComposeTitleBar候选；R | ADAPT | G-TITLE核对onBack/保存退出和材料；去除common对漫画Visual/PressFeedback反向依赖；共同底座拥有框与度量；G-C1/L2 | 设置/书架设置/详情/目录/书源及工具；[保留]管理/RSS/Sync | 旧模式的返回、标题、actions和尺寸均有后继且无消费者后 |
| `ReaderFixedHeaderHost.ets` | chrome.page：固定header测量/绘制执行 | N布局/onAreaChange；R | ADAPT | 只向该页唯一装配owner回报带layout identity的真实高度；不保存第二份页面输入，不与bar叠画框；可按实际消费者合并为内部实现 | PageScaffold；ReaderLibrarySearchSurface | 竞争测量/重复外框与兼容分支迁出后删除；无必要消费者时合并，有独立测量职责时保留 |
| `ReaderHeaderMetrics.ts` | chrome.bar：基础尺寸约束 | R；N度量 | ADAPT | 初始值作fallback/minimum；真实标题/字体/动作参与测量，不让页面复制height | AppTopBar/PageBackBar/HeaderSpecs/PageShell、BookDirectoryPage | 旧固定值不再是内容高度权威后逐项删别名 |
| `ReaderHeaderSpecs.ets` | chrome.bar：有限语义recipes与feature数据边界 | R/U已批准外观；N布局 | ADAPT | 公共title/back/search/selection与书架/详情/目录/搜索内容尺寸分责；先记录确有差异的变体，退役纯页名tuple | BookshelfPage/Shell/Status、LocalBookDetail、ReaderFullDirectory、搜索 | 每个旧spec的真实消费者迁完、fallback实测可用后退役旧出口 |
| `ReaderFloatingBarMetrics.ts` | foundation.geometry：悬浮bar目标/预算 | R；N测量 | ADAPT | 用统一窗口/字体事实算悬浮顶栏/dock/nav预算，实际高度回报；G-L1 | Bookshelf、详情、SourceManagement、MainNavigationSpec/MainTabBar；[保留]RSS/Discover | 每页私算的同类预算迁完后删旧旁路 |
| `ReaderFrameStyle.ts` | chrome.page：有限表面/安全区纯策略与类型 | R；N平台frame | ADAPT | 保留有限承载角色；由该页唯一装配owner组装并交绘制层，不保存可写事实或覆盖另一owner结果；不开放任意style bag | PageScaffold/FixedHeaderHost/StandardPage、各具名专用page adapter | 旧任意appearance/竞争覆写接口无消费者后退役；纯策略文件可按真实用途保留或合并 |
| `ReaderLayoutCapability.ts` | foundation.environment：窗口能力投影 | R/ReaderWidthClass；N窗口 | DIRECT | 继续按当前窗口事实判断布局，不按设备型号；消费统一snapshot | pages/Index | 统一environment后继完整承接后可合并文件，不重写断点机制 |
| `ReaderLayoutDebugOverlay.ets` | developer.ui：边界诊断 | R；N测量/绘制 | KEEP | 保持明确开发开关，不进入产品用户流，不把诊断视图当实际布局authority | pages/Index `[开发]` | 用户明确退役开发能力或等价诊断替代后 |
| `ReaderMeasurements.ts` | foundation.geometry：有身份的测量记录 | R；N测量回调 | DIRECT | 保留generation、有效值及失效；普通Scroll页面store归StandardPage，专用页面归现有具名adapter；同一实例只有一个测量采纳owner，不变业务事实 | StandardPage、BookDirectory、MultiSelect、详情、Source、下载 | 竞争store和旧回调有后继并迁出后退役；通用记录能力及不同页面独立store合法保留 |
| `ReaderPageGeometry.ts` | foundation.geometry：唯一纯resolver及共同输入/输出 | R；N窗口/测量 | ADAPT | 沿用resolveReaderPageGeometry与同一Input→Geometry合同；普通Scroll或领域adapter各自闭合所属实例的真实宽高/rail/tail/安全区/测量输入，下层共享同一只读快照 | StandardPage、MainTabShell/ReaderShell及书架/搜索/下载具名适配器 | 删除复制算法、竞争输入与旁路覆写；多个合法adapter调用同一纯resolver不退役，不另建求解器 |
| `ReaderPageScaffold.ets` | chrome.page：已解析几何的绘制/测量执行层 | N Stack/布局/安全区；R | ADAPT | 只执行该页owner提供的同一只读快照和有限frame；统一header/content/footer/overlay层级、可见性及命中，回报测量不另行装配 | StandardPage及MainTabShell/ReaderShell、详情/目录/搜索/Source/下载/Index的具名组合 | 第二套同层frame/竞争装配迁出后删除；保留有依据的纯执行或按消费者合并，不强制专用页套StandardPage |
| `ReaderPageScrollHost.ets` | chrome.page：原生Scroll执行适配 | N Scroll；R insets | DIRECT | 仅消费普通Scroll owner已解析的只读ScrollLayout，scroller由原owner提供；不求解第二份几何，不包裹List/Grid/阅读viewport | ReaderStandardPage | 同职责重复Scroll适配有真实后继后合并；保留原生滚动与单次inset消费，不凭多文件要求删除 |
| `ReaderPageShell.ts` | chrome.page：有限角色/预算纯策略 | R；N环境 | ADAPT | 保留实际公共纯规则，与feature约束分责；各页面唯一owner调用并输入同一resolver，消除隐式页名偏移，不生成第二份可写布局状态 | StandardPage/Scaffold及书架、搜索、SettingsShell、Source、下载adapter | 复制预算、无依据魔数及竞争装配出口无消费者后退役；有独立实际用途的纯函数/类型可保留或合并 |
| `ReaderStandardPage.ets` | chrome.page：普通Scroll页面的装配owner | N Scroll/Scaffold；R | ADAPT | G-L1声明并透传width/height、rail/tail及viewport回调；拥有该实例测量/layout identity，以既有resolver形成同一只读快照到Scaffold、Scroll、overlay；不接受竞争geometry | SettingsPage/Shell、BookshelfSettings、SourceTools、消息预览；[保留]管理/RSS/Sync | 普通Scroll分支的重复求解/测量/覆写旁路在真实迁入后退出；保留此有限组合，不扩成所有页面万能门面 |
| `ReaderScrollLayout.ts` | foundation.geometry：只读滚动避让派生 | R；N Scroll/List/Grid | DIRECT | 从该页唯一已解析Geometry派生start/end/mode，原生容器只应用一次；不保存另一份页面预算，保持原锚点寿命 | StandardPage；reading目录系列等原生列表 | 旧numeric inset/重复计算在实际后继迁完后退役；多个内容容器使用同一纯派生合同合法保留 |
| `ReaderSurfaceRect.ts` | foundation.geometry：展示身份/坐标模型 | R业务身份；N测量结果 | DIRECT | 保留window/local同单位合同和route/owner/generation校验 | BookshelfPage、ReaderLibrarySearchSurface、Index | 只有统一坐标合同完整接管后；不因bar整合删身份 |
| `ReaderSurfaceRectMeasurement.ets` | platform.geometry：原生节点测量 | N FrameNode/ComponentUtils；R身份校验 | DIRECT | 保留px/vp边界、未缩放/未旋转前提和节点消失处理 | BookshelfPage、Index | 新原生测量入口证明同单位/identity/transform合同后 |
| `ReaderSurfaceResolvers.ts` | foundation.geometry：字体/表面尺寸适配 | R；N真实测量候选 | ADAPT | 真实测量优先，统一字号增长fallback/minimum，禁止页面另造scale公式；G-L2 | Button/FormField/Choice/Dialog、SettingsSelect、下载等 | 单一度量路径完成后退役重复公式；不将所有内容机械同高 |
| `ReaderWidthClass.ts` | foundation.environment：宽度分级 | R；N当前窗口 | DIRECT | 继续按viewport、与LayoutCapability同源；不新增第二断点表 | 书架、MultiSelect、ReaderShell/FullDirectory、MainNavigation、漫画 | 统一environment显式合并并迁完旧导出后 |
| `ReaderWindowMetrics.ts` | platform.environment：窗口事实模型 | N Window/System；R单位模型 | DIRECT | 与ReaderWindowCoordinator保持单一snapshot；只记录系统/窗口事实，不混页面业务 | Coordinator/StatusBarMeasurement、PageGeometry、shell和专用宿主 | 新系统适配完整承接且真实窗口变更证明后；本轮不替换平台机制 |
| `SurfaceHorizontalGeometry.ts` | foundation.geometry：水平安全框resolver | R有限规则；N测量 | DIRECT | 复用当前maxWidth/左右安全区合同，避免popup/页面复制左右边距 | PageGeometry/Dialog；书架/详情/搜索/Source与原生宿主 | 重复同类水平计算迁完后退役旁路，不另加通用布局算法 |

### 4.3 控件、选择、字段、行与卡片（24）

| 当前文件 | 目标公共家族/模块 | 来源 | 决定 | 必要适配 | 真实消费者 | 退役条件 |
| --- | --- | --- | --- | --- | --- | --- |
| `ReaderActionAccessibility.ets` | controls：自定义组合的必要语义适配 | N语义/焦点；R | ADAPT | 原生控件直接用其语义；该modifier仅用于有充分理由的custom composite，区分action/navigation/choice与信息，统一目标占位 | BookshelfPage、SearchTaskPanel、ReaderSearchField | 原生已完整覆盖的modifier叠加退役；专用composite仍需适配 |
| `ReaderButton.ets` | controls.action：原生Button薄适配 | N Button优先；R既有recipe | ADAPT | G-C1；所有动作统一enabled/busy/label/owner失效和目标下限；选择chip转choice语义；禁止继续扩充页名button | SourceManagement/Tools、Search各panel、JsonImport；[保留]RSS/管理/Sync | 原Text/Stack按钮生产分支、旧页名spec在消费者迁完后删除 |
| `ReaderIconButton.ets` | controls.action：原生图标Button | N Button；R图标映射/recipe | ADAPT | 原生焦点/命中/语义优先；保留非空label和真实准入；44vp由布局保证；G-C1 | SourceManagement、ReaderChapterLoadingState、漫画；[保留]Discover | Stack自绘交互被原生后继完整覆盖后退役，不重做图标资源 |
| `ReaderLabeledIconAction.ets` | controls.action：图文动作组合 | N Button/Image/Text；R | ADAPT | 与Button共享交互原语；图文横纵布局作有限变体，content不能重画frame | SourceManagement；[保留]Discover/RSS各页 | 原单独交互实现和页名variant消费清零后退役 |
| `ReaderLabeledIconActionSpecs.ets` | controls.action：语义action recipes | R当前表；N Button | RETIRE | 逐项映射到动作tone/size/icon-placement，保留有依据的布局差异；不复制成另一个页名表 | 仅ReaderLabeledIconAction；间接上述页 | 每个导出ID有已消费后继和视觉/语义证据后删除旧表/兼容ID |
| `ReaderPressFeedback.ets` | foundation.surface：有限状态层适配 | N pressed/focus/ColorMetrics；R批准样式 | ADAPT | 原生控件默认状态优先；必要自定义状态用平台attribute；补focused而非页私绘，保留disabled事实 | Button/Icon/LabeledAction/Toggle/Dialog、CategoryRow、Source | 平台已完整表达的重复状态分支删除；保留必要主题映射 |
| `ReaderControlSpecs.ets` | controls：语义action/field/search recipes | R历史表；N实际控件 | RETIRE | 先建立逐ID→现有实际消费者→语义后继映射；将primary与selected分离；只保留有证据的有限形态，G-C1至C4 | Button/Icon/Form/SearchField；Search各组件 | 所有旧ID、直接geometry重导出和生产导入迁完后删旧表，不能保留双完整体系 |
| `ReaderToggle.ets` | controls.choice：原生Switch/Toggle适配 | N Toggle优先；R身份/主题 | ADAPT | G-C2；保留受控value、busy、稳定身份与owner回调，整行label关系由ToggleRow承担 | Settings、SourceManagement；[保留]RSS/Rules | custom Stack/thumb分支被完整原生能力接管后删除 |
| `ReaderSegmentedControl.ets` | controls.choice：受控短枚举 | N Radio；N-A SegmentButton API23候选；R | ADAPT | G-C2/G-CHOICE：@Link下标只作临时桥，核固定字体/44vp/字号；不用24/26新属性；options为稳定value/ID，补书架模式 | SettingsPage App主题；书架显示方式为待迁消费者 | 固定168×36与page-specific实现的后继全接通后退役 |
| `ReaderSwitchSpecs.ets` | controls.choice：有限密度/形态 | R；N Toggle/选择器 | RETIRE | 核对standard与bookshelf-update真实需要；未消费的book规格不能计已迁移；语义与平台尺寸解耦 | Toggle/SegmentedControl；bookshelf-update当前无消费 | G-C2完成且现用ID后继迁完后删除历史表，不保留空规格 |
| `ReaderFormField.ets` | controls.field：原生输入薄适配 | N TextInput/TextArea；R | ADAPT | G-C4；分离字段语义与page spec，明示inputIdentity、label/validation、editing/submit/password；不拥有draft | SourceTools、JsonImport、阅读搜索/替换/TTS；[保留]管理/RSS/Sync | 旧页名field分支迁完后退役；原生编辑/控制器保留 |
| `ReaderSearchField.ets` | controls.search：受控搜索组合 | N TextInput/原生动作；R | ADAPT | 复用native field；统一清除/提交/停止、busy、focus和生命周期；library/source/content搜索差异以语义组合表达 | SourceManagement、SearchPage、ReaderLibrarySearchSurface | 页私重复搜索外框/交互与旧geometry后继接通后删除 |
| `ReaderSearchControlGeometry.ts` | controls.search：有限实际几何 | R已批准搜索形态；N测量 | ADAPT | 高度/动作列由真实字高与availableWidth推导；Typography不反向依赖搜索feature固定字值 | ControlSpecs、Typography、SearchHistoryGeometry | 搜索统一度量迁完后删重复固定公式/重导出，保留必要形态约束 |
| `ReaderSelect.ets` | controls.choice：原生选择触发适配 | N Select/原生Button候选；R | ADAPT | G-C3；label/value/expanded/disabled/focus明确；不得只onClick；样式来自语义和承载recipe | SourceManagement；InlineSelect→SourceTools/下载/目录规则；阅读外观 | 原生完整覆盖的自画trigger分支和页名variant迁完后退役 |
| `ReaderSelectPanel.ets` | presentation.choice：选择内容/宿主适配 | N Select或原生popup；R ChoiceRow | ADAPT | G-C3/O1；稳定option ID、selected、滚动高度、锚点和展示身份；row调用统一choice语义 | SourceManagement、阅读外观、InlineSelect | 原生菜单完整覆盖的面板/动画/选项重复分支删除；必要适配有失败样本 |
| `ReaderInlineSelect.ets` | controls.choice：有界原生宿主组合 | N bindPopup/Select；R现有组件 | ADAPT | 同一Select合同透传enabled/expanded/字段名与身份，不能仅opacity禁用；不拥有业务选择 | SourceTools、下载、ReaderDirectoryRules | 与统一原生Select入口等价后删除多余宿主分支；不再新建Inline选择体系 |
| `ReaderSelectGeometry.ts` | presentation.choice：选项测量/安全框适配 | R；N测量/安全区 | ADAPT | 与统一环境/水平框共享度量，区分触发器与菜单可用宽；原生完整覆盖优先 | Select/Panel/InlineSelect | G-C3完整覆盖、全部measure调用有后继后退役多余算法 |
| `ReaderSelectAppearanceStyle.ts` | reading.appearance：专用外观选择布局 | R已批准阅读外观；N popup/测量 | KEEP | 明确归属阅读feature，只保留专用形变/位置约束；基础交互和选项归公共choice | ReaderControlAppearanceContent、ReaderSelectPanel | 阅读专用形变整体后继验证后；不得因此扩成普通页选择规范 |
| `ReaderChoiceRow.ets` | controls.choice / patterns.ChoiceRow | N Radio/选择语义；R行组合 | ADAPT | G-C2/C3/C5；统一role/selected/focus/装饰图标/disabled，value独立label；title/height支持增长 | SelectPanel→书源分组/工具/下载/阅读；[保留]SettingsSelectOverlay | 无语义Row/Stack选项及旧label即identity出口迁完后退役 |
| `ReaderChoiceSpecs.ets` | controls.choice：语义密度/选择形态 | R历史行表；N选择器 | RETIRE | 将default/source/settings/appearance ID映射到有限选择与承载合同，专用阅读约束归feature | 仅ChoiceRow及其实际链 | 所有ID与positioned旧行有明确后继并迁完后删表，不能机械抹平有用差异 |
| `ReaderCard.ets` | patterns.card：普通内容/表单分组外框 | N布局/表面；R现有组件 | ADAPT | 公共拥有fill/border/radius/padding/标题边界；补SourceTools/书架设置消费者，业务body保留 | CategorySection；[保留]Sync；SourceTools/BookshelfSettings待迁 | 页私普通卡frame全部迁入后删除重复外框；书籍封面等feature组合保留 |
| `ReaderCardSpecs.ets` | patterns.card：承载语义recipes | R；U已批准形态 | ADAPT | 保留standard/section等有证据形态；management/rules无消费规格不能冒充覆盖；取消按页分spec | ReaderCard→CategorySection/[保留]Sync | 未消费旧ID在实际需求裁决后退役；不能预先删掉所需普通表单卡 |
| `ReaderSectionHeading.ets` | patterns.collection：分节标题 | N Text/测量；R Typography | ADAPT | 去固定16高，语义heading/长标题/系统字号；公共拥有文字和组间距合同 | CategorySection→Settings；其他消费者按实际迁入 | 页私同类heading与旧固定高度分支迁完后退役 |
| `StatusBadge.ets` | patterns.collection：只读状态标记 | N Text/Image/语义；R | ADAPT | 从任意bg/dot/radius改为状态语义+文字/标签；图标装饰与可读状态明确，不能只靠色点；InfoRow承载 | Settings、SourceManagement；[保留]RSS | 任意外观参数和仅颜色表达的旧消费迁完后退役 |

### 4.4 菜单、面板、确认与表面（9）

| 当前文件 | 目标公共家族/模块 | 来源 | 决定 | 必要适配 | 真实消费者 | 退役条件 |
| --- | --- | --- | --- | --- | --- | --- |
| `ReaderActionMenuSurface.ets` | presentation.menu：原生宿主+动作列表 | N菜单/popup/sheet候选；R | ADAPT | 稳定action ID/tone/enabled/busy，原生Button/菜单语义；宿主与外框单一owner，G-O1 | BookshelfMoreMenu、ReaderControlPanel、ActionSheetContent | 重复menu/sheet外框与旧spec出口迁完后退役 |
| `ReaderActionSheetContent.ets` | presentation.sheet：共享动作内容 | N List/动作控件；R | ADAPT | 动作行与公共action/row同源，展示适配不承担下载/书架事务 | BookshelfMoreActionSheet、ReaderShell、下载、漫画、SheetActionList | 同类动作行重复实现迁完后删；feature操作模型仍由owner给出 |
| `ReaderSheetActionList.ets` | bookshelf.actions：书籍动作业务适配 | R书架有限动作；N公共sheet | KEEP | 保留presentation/action token和一次派发，组合公共ActionSheetContent，归书架职责 | BookshelfBookActionSheet | 书架业务适配后继保留全部身份/动作语义后；不归入通用menu算法 |
| `ReaderBoundedSurface.ets` | presentation.surface：sheet/popup/editor承载适配 | N原生宿主/布局；R | ADAPT | 拆承载关系与feature名称，公共只拥有frame/content区；原生sheet只画一次外框，G-O1 | 本地导入、书架动作、搜索filter/task、换源、阅读编辑/TTS、下载/漫画 | 各历史spec有实际后继、原生宿主证明后删除大分支；不新增万能overlay状态机 |
| `ReaderBoundedSurfaceHeader.ets` | presentation.chrome：共享标题/关闭区 | N Text/Button；R | ADAPT | 统一标题文字增长、关闭动作/label/目标、测量；关闭仅发意图 | BoundedSurface各实际panel/本地导入/下载/漫画 | 页私同类header和当前按feature分支迁完后退役 |
| `ReaderBoundedSurfaceActions.ets` | presentation.actions：底部动作区 | N Button/布局；R | ADAPT | 复用Action，有限inline/stack布局、busy/disabled、长文案和键盘预算 | LocalImportDialog、ReaderControlReplaceContent、ReaderTtsConfigOverlay | 自有Text动作交互与旧tuple后继接通后删除 |
| `ReaderDialogSurface.ets` | presentation.dialog：确认/编辑框外观适配 | N NativeAlert/CustomDialog宿主；R | ADAPT | 遵守消息分类；标准确认优先NativeAlertOwner，特定dialog body用既定surface；补关闭语义/焦点/键盘/长内容 | BookRemovalDialog、JsonImport、下载、Index；[开发]消息预览 | 原生已完整覆盖的重复dialog动作/框体在宿主迁完后删，不改确认业务 |
| `ReaderRaisedSurface.ets` | foundation.surface：必要的悬浮阴影适配 | N shadow候选；R现有Canvas | KEEP | G-S1登记精确缺口；当前仅shadow、不可命中，frame由原owner画；不扩建绘图引擎 | PageBackBar、详情、LibrarySearchSurface、MainTabBar、下载 | 原生shadow/material完整覆盖已批准效果及密度/裁剪后退役caster Canvas |
| `ReaderSurfaceSpecs.ets` | foundation.surface + presentation有限recipes | R/U已批准表面；N宿主 | ADAPT | 拆公共层级/材质/圆角与source/reading特定内容；禁止common反向拥有feature视觉算法；动作尺寸由公共控件接管 | 菜单/面板/Dialog/RaisedSurface及书架、搜索、下载、漫画 | 每个旧popup/dialog/sheet spec有后继消费者、无双外框后逐项退役 |

### 4.5 页面状态、反馈和恢复（5）

| 当前文件 | 目标公共家族/模块 | 来源 | 决定 | 必要适配 | 真实消费者 | 退役条件 |
| --- | --- | --- | --- | --- | --- | --- |
| `ReaderPageState.ets` | messages.state：加载/空/无内容失败 | R消息框架；N Text/原生loading/action | ADAPT | 保持与有内容恢复分类分离；动作复用原生Action、文字增长/朗读/实体身份；不拥有retry | 启动恢复、书架、详情、搜索、Source、阅读目录/书签、下载、漫画；[保留]其他页 | 页面同类私有外框迁完后删除；任务/资源专用宿主按登记保留 |
| `ReaderRecoveryAction.ets` | messages.action：原owner恢复意图 | N Button优先；R generation合同 | ADAPT | 公共Action呈现；保持generation/current，明确继续原操作/重新读取等语义；不把读取成功当写入确认 | RecoveryNotice/PageState及各recovery surface | Text/Stack动作分支被完整原生动作覆盖后删，保留owner判断 |
| `ReaderRecoveryNotice.ets` | messages.recovery：有内容的原操作未决提示 | R ReaderRecoveryProjection/框架；N布局 | ADAPT | 统一标题/详情/展开/动作及anchor生命周期，业务fact从原owner传；关闭不取消 | Settings/Bookshelf/Reading/Source等已有恢复入口 | 业务入口登记完成且同类自绘Notice被替代后删旧frame，不能重置业务状态 |
| `ReaderTransientFeedback.ts` | messages.feedback：短事实发布/宿主适配 | R现有去重/host/generation；N UIContext | KEEP | 保留owner有效性、foreground、单host和跨layer退休规则；不增加队列/持久化业务 | 书架/搜索相关owner、设置、Source、阅读、下载、漫画、Index | 仅在新的展示适配保持全部失效规则后替换；本轮无退役 |
| `ReaderTransientToast.ets` | messages.feedback：统一可视宿主 | R框架；N窗口/布局/动画 | ADAPT | 保持一个有效layer宿主，字体/安全区/朗读/减少动态效果与统一foundation接通 | pages/Index；native cover/sheet按框架注册host | 业务页私有普通Toast全部迁完后退役旁路；不因原生API存在擅换已批准消息合同 |

### 4.6 动效机制与有限编排（7）

| 当前文件 | 目标公共家族/模块 | 来源 | 决定 | 必要适配 | 真实消费者 | 退役条件 |
| --- | --- | --- | --- | --- | --- | --- |
| `MotionPointTrack.ts` | reading.motion：专用呈现采样适配 | R当前track；N动画/Animator候选 | ADAPT | G-M1；先复查原生完整覆盖，再只保留重定向同采样点的必要薄适配，不继续扩建通用插值库 | ReaderControlAppearanceContent | 原生/上游完整覆盖当前轨道、反向与销毁语料后删除重复采样算法 |
| `MotionSpec.ets` | foundation.motion：语义token/原生曲线 | N curves/AnimateParam；R批准节奏 | ADAPT | 原生曲线直接复用；common不反向import source/manga视觉或reading编排；feature编排参数归feature，通用入口走MotionPolicy | 书架/LibrarySearch/阅读/换源/下载/漫画；SelectPanel | 直接旁路时长、页名重复token迁完后退役，不重写曲线算法 |
| `MotionTimeline.ts` | feature.motion：有限可逆时间线适配 | R当前有限编排；N Animator候选 | ADAPT | G-M1；记录seek/retarget/reverse的真实缺失，完整原生覆盖则替换通用机制；保留Reader阶段定义 | BookshelfNavigationTransition/Page、ReaderSessionLaunch、LibrarySearch、PointTrack | 完整同采样点反向/0时长/中断证明后删除旧通用timeline；不得永久双执行路径 |
| `ProductMotionTiming.ts` | reading.motion：产品阶段编排 | R已批准阅读/控制层时序；N执行 | KEEP | 只保留阶段/轨道关系，时长收敛与减少动态效果消费公共policy，不做通用时钟 | LocalReadingExperience、ReaderControlPanel | 阅读动效整体后继等价验收后；本轮不改手势/翻页算法 |
| `ReaderMotionClock.ets` | platform.motion：单调时钟 | N systemDateTime uptime；R薄适配 | DIRECT | 复用同一ACTIVE uptime，避免epoch/frame混用；不自建scheduler | EntryAbility、书架/阅读/搜索动画、段落诊断 | 原生统一时钟后继完整承接后可合并，禁止双时基 |
| `ReaderMotionDurationPolicy.ts` | foundation.motion：时长/0时长纯策略 | R当前函数；N动画执行 | DIRECT | 同一减少动态效果值控制普通/专用动画；不拥有动画进度和业务完成 | MotionPolicy、reading/ReaderControlMotionPolicy | 所有旧duration出口迁完后删重复函数，不改变业务settlement |
| `ReaderMotionPolicy.ets` | foundation.motion：统一执行参数入口 | N animateTo/curve；R policy | ADAPT | 所有普通动画/transition消费同一reduceMotion；0时长、取消和卸载仍完成必要展示清理；专用编排经薄适配 | Select/Panel/Toast、书架菜单/导入、目录、换源、漫画、Index | feature直接绕过policy的同类参数生产消费迁完后退役 |

### 4.7 位于 common 的业务/专用展示文件（10）

这些文件不能因目录名而被升级为通用 UI 框架；整理时按职责归属，不以移动文件充当接入成果。

| 当前文件 | 目标公共家族/模块 | 来源 | 决定 | 必要适配 | 真实消费者 | 退役条件 |
| --- | --- | --- | --- | --- | --- | --- |
| `BookAcquisitionPresentation.ts` | acquisition/search业务投影 | R/Core事实 | KEEP | 保留schema/sourceVersion/新鲜度/故障分类；UI只展示结果，不迁入控件 | features/reading/application/BookAcquisitionCoordinator、SearchCandidatePolicy | Core/业务协议有明确后继后；不属UI替换范围 |
| `BookAuthorMetadata.ts` | book业务元数据展示投影 | R既有字段优先级 | KEEP | 原作者归属与字段合并保留，控件仅消费文字 | 书籍身份/详情、搜索projection、ReadingBookDetail、换源、Index | 元数据协议后继证明无损后；本轮无退役 |
| `BookCoverDisplay.ts` | book/reading封面资源适配 | R读取准备与封面合同 | KEEP | 保留资源可用性与位置/生命周期，Image组件呈现消费公共占位规则 | LocalBookDetail、ReadingEntryHost | 资源协议后继/故障恢复证明后；不以换Card替代资源owner |
| `BookIntroText.ts` | book业务简介投影 | R当前有限文本处理 | KEEP | 保留简介展示事实；若发现通用解析重复进入上游复评，不在UI合同中添加新parser | LocalBookDetail、SearchPage | 等价元数据/上游能力覆盖真实语料后按业务任务迁移 |
| `BookSearchTiming.ts` | search/source业务节奏 | R已有请求/搜索时序 | KEEP | 与纯视觉Motion分开；不把搜索超时改成动画时长 | SearchGateway、SourceSwitchGateway、Index | 搜索业务协议整体后继验证后；本轮无退役 |
| `CachedBookIdentity.ts` | 未接入的缓存身份业务投影 | R自有并查/归一化实现；Core/上游候选未核实 | DEFER | 当前生产源码无导入消费者；G-X1先确认保留意图，并按开源原则复评通用并查/缓存部分，禁止借本轮接入或扩建 | 仅本文件定义内部互用，无生产导入 | 明确关闭决定后退役；需重新接入则先证明Core/成熟能力不能完整覆盖并做数据语料验证 |
| `JsonImportDialog.ets` | import业务表单组合 | R导入owner；N输入/对话宿主 | KEEP | 继续组合公共Dialog/FormField/Action，原导入draft、解析/提交和身份不归UI；用G-C4/O1 | pages/Index | 业务导入组合后继完整保留原操作/数据恢复后；只删除被替代外框/基础控件 |
| `ReaderMangaDownloadPopup.ets` | manga.download专用适配 | R漫画动作模型；N公共popup/sheet | KEEP | 业务动作保留，外框/标题/按钮/语义接公共presentation；保持准确实体与保数据语义 | BookDirectoryPage | 漫画下载动作宿主后继保持身份/关闭/取消边界后 |
| `ReaderMangaDownloadPopupSpec.ts` | manga.download有限布局约束 | R已批准漫画recipe | KEEP | 专用内容与公共frame/动作尺寸分责，不能被普通页作为任意popup模板 | ReaderMangaDownloadPopup | 公共承载完整接管的重复frame字段消费清零后退役字段；保留必要业务布局 |
| `SharedDownloadVisualSpec.ts` | downloads.view：受控生成的专用视觉数据 | U批准download/storage demo；R | ADAPT | 先从权威demo/生成链分出公共bar/button/card/field与任务内容；Typography不反向读取feature值；不手改生成值 | SharedDownloadPage、ReaderTypography | 每个被公共家族接管的字段均有真实消费者后继后退役对应生成字段/依赖；任务布局保留 |

## 5. common 之外必须接入的组合职责

这些是填补家族覆盖的实际迁移，不创建缺乏消费者的运行时框架；业务页面完整清单由整体方案的页面迁移附件维护。

| 当前实际模块 | 目标与决定 | 必须保留/适配 | 明确退役对象/条件 |
| --- | --- | --- | --- |
| `features/settings/CategoryRow.ets`、`CategorySection.ets`、`SettingsPage.ets` 的私有label/select/segment/cache/danger行 | ADAPT → Row/Card/Section家族，N-A ComposeListItem先裁决，参考O2语义分工 | navigation/action/toggle/choice/field/info明确分类；核Reader字体、enabled/busy、整行与内部owner；普通title/说明/图标盒共享；关闭语言/启动选择仍标保留 | 每个可见入口完成语义/交互/字号迁移后删除私有同类frame与点击实现；禁止一律给有子控件的父行再加button语义 |
| `features/bookshelf/ui/BookshelfSettingsPage.ets` | ADAPT → ToggleRow、受控短枚举、Card | 设置页可见入口；原自动更新和显示模式事务/generation不改；G-C2 | 裸Toggle与Text二选项迁到同一公共合同；未消费bookshelf-update旧规格一起裁决 |
| `features/source/ui/SourceManagementPage.ets`、`SourceToolsPage.ets` | ADAPT → Action/Choice/Search/Field/Card/Row/BackBar | source实体ID、选择/导入/检测/编辑原owner和List数据源；普通卡片/按钮/筛选必须共享 | 检测/登录28vp自画目标、工具页普通卡frame、页私输入/选择/重复bar在后继接通后退役 |
| `features/shell/MainTabShell.ets`、`SettingsShell.ets`、`MainTabBar.ets`、`MainNavigationRail.ets`、`MainNavigationOverlay.ets` | ADAPT → 现有Navigation/Page/Bar组合 | 保留真实路由/返回/轨道偏好；普通Scroll分支由StandardPage装配，MainTabShell仅供导航输入；专用分支保留具名adapter；G-L1补齐声明、透传与真实传播 | 平行坐标预算与双框，及底栏/侧轨各自维护的同类action规则在迁完后退役 |
| `features/bookshelf/ui/BookshelfPage.ets`、`BookshelfMultiSelectPage.ets`、`LocalBookDetail.ets`、`BookDirectoryPage.ets` | ADAPT公共chrome/选择/状态；KEEP书籍/目录feature组合 | 书籍卡/封面/目录内容、List/Grid身份与滚动、阅读交接不并入万能Row | 普通topbar/selectionbar/底部动作/卡frame重复实现有消费后继后删除；合法书籍组合不删 |
| `features/search/ui/ReaderLibrarySearchSurface.ets`、`SearchPage.ets`、Filter/History/TaskPanel | ADAPT公共Search/Choice/Bar/Sheet/State；KEEP搜索会话投影 | 共用搜索会话、查询/停止的原owner；任务事实按专用宿主登记，保留原动画身份 | 并行表面外框、selected当primary、局部自画基础操作在完整迁入后退役 |
| `features/downloads/ui/SharedDownloadPage.ets` | ADAPT公共Bar/Action/Choice/Field/Sheet/Dialog；KEEP任务组合 | 任务/章节选择、调度、存储草稿、保数据、presentationGeneration保留；普通控件义务与其他页一致 | 下载页自己的普通按钮/搜索/选择器/通用sheet外框recipe按实际接入删除；专用任务行/结果不强塞PageState |
| `features/reading/*`、`features/manga/*` 与现有PhotoView/PullToRefresh vendor | KEEP专用渲染/手势/轨道；ADAPT chrome/controls/messages/environment | 现有上游来源/许可/patch不改；分页、纹理、缩放、tile、位置/目录锚点、TTS业务不吸入公共UI；G-M1/G-O1按实际边界评估 | 普通动作/输入/选项/面板外框迁入后删除其重复分支；专用算法只有完整上游替代与数据保护验证后才换 |
| `[保留]` RSS/Discover/Sync、RulesManagement/BookshelfManagement及无可见消费者的兼容面板 | DEFER生产迁移；REFERENCE_ONLY其现存消费作为需求样本 | 分别记录产品关闭、无可见入口、compat保留原因；公共能力迁移不自动开放业务 | 开放前必须按同一合同接入和验收；不能计入当前生产完成数，也不因关闭先删测试/清数据 |

## 6. 实施顺序、完成与退役闭环

1. **基线与能力裁决**：把第 3 节 gap 绑定到实际 SDK、消费者和已有证据；按需选择最小源码探针，输出DIRECT/ADAPT的证据，不先写一批空抽象。根主题/窗口/消息事实仍由现有owner提供。
2. **先收口G-L1并做有界可行性核对**：UI-01完成宽高/rail/tail/回调的声明和透传、每页唯一装配/测量及同一resolver快照传播，以真实设置链与失败反例独立验收。同步核对书架搜索共享头面、阅读/漫画保留宿主是否能使用同一几何输入/输出与身份合同，必要时选择有限源码探针；此时不整迁复杂界面，也不等待其全量/设备验收。按§2.3补必要检查及登记，所有检查工具仍是后续实施内容。
3. **随消费者分批补家族与迁移**：首批只完成设置/书架设置所需的UI-02动作、选择、行卡等能力并验收真实纵切，再处理书源管理/工具，随后下载；各批按真实需求增量裁定原生能力与公共API，不先铺全部家族。复杂迁移再进入书架搜索以及阅读/漫画，保留其原生内容容器和owner。代表纵切后继续补齐页面附件的全部11个可见路由及N01–N15中的有效用途，详情/目录/导入/换源/TTS等不被后移裁掉；页面迁移与算法替换分别记账。
4. **按库存条件退出被替代职责**：87项已有的消费者与退役条件在实施时展开为全部真实引用和必要证据；RETIRE及ADAPT中被替代出口沿“旧导出/消费者→唯一后继→同一语义/主题/字号/生命周期证据→生产引用清零”删除旧实现、spec和兼容出口。保留有依据的纯函数/类型、Core/业务owner与资产协议，不以多文件认定重复，也不强制所有ADAPT永久保留原文件。测试按新合同保留必要行为，不删测试伪装完成。
5. **按风险分层补证**：依赖方向、公开输入类型与实际传播、真实consumer和退役检查按本批变化进入现有源码检查路径；不新建检查框架，不因局部迁移自动运行全套。源码/类型、本地交互、编译、产物、VM/真机及用户视觉验收分别记录；未执行写NOT_RUN，选中失败写FAIL。设备只回答源码/必要本地验证无法回答的具体问题，不作为所有独立工作的统一前置；缺失的必要运行/视觉证据仍不能被宣称通过。本次仅改方案，未改代码、检查、CI或治理文件，未执行产品构建或设备操作。
6. **整体完成条件**：87项均有职责/真实消费者及保留、合并或退役闭环；每个页面实例只有一个输入装配/测量owner，所有合法适配器使用同一resolveReaderPageGeometry及Input/Output合同，内容/头尾/overlay共享同一只读结果；竞争输入、重复框和复制算法退出，合法纯模块与专用容器保持。基础层反向依赖逐批按有限登记缩减，每种语义有唯一交互/外框权威；全部可见旅程的公共或具名领域合同已落实，无页名无限spec/任意外观逃逸和永久双体系；主题、字号、窄宽屏、键盘、语义/焦点、减少动态效果与旧回调失效具备所需证据，书库、书源、位置、书签、任务和设置事务保持。

以上六节保留最初的采用和迁移决定。第 7 节单独登记实施中的生产源码处置。

## 7. 第 8 批源码处置记录

第 4 节保留 87 项原始分母及退役条件。当前工作树按生产 ETS/TS 的定义路径和相对静态导入登记，包含类型导入与转导出。34 项迁入 `ui`，3 项归还各自功能，2 项旧规格文件已退役，48 项仍在 `features/common`。以下是源码接线证据。原生交互、构建和设备验收为 `NOT_RUN`。

| 处置 | 生产后继和真实接线 |
| --- | --- |
| 9 项页面几何和装配迁入 `ui/layout` | `ReaderFixedHeaderHost`、`ReaderFrameStyle`、`ReaderMeasurements`、`ReaderPageGeometry`、`ReaderPageScaffold`、`ReaderPageScrollHost`、`ReaderPageShell`、`ReaderStandardPage`、`ReaderScrollLayout` 原路径移除。[标准页](../../entry/src/main/ets/ui/layout/ReaderStandardPage.ets#L69) 按当前视口和头尾测量解析快照，交给 Scaffold 和原生 Scroll 执行。书架设置恢复提示消费同一 `contentStartInset`。[详情](../../entry/src/main/ets/features/reading/ui/LocalBookDetail.ets#L173)、[独立目录](../../entry/src/main/ets/features/reading/ui/BookDirectoryPage.ets#L371) 和下载保留各自的列表与几何输入。 |
| 12 项共享事实迁入 `ui/foundation` | `ReaderThemeRegistry`、`ReaderTokens`、`ReaderLayoutTokens`、`ReaderFontFamilies`、`ReaderTypography`、`ReaderActionIconResources`、`ReaderHeaderMetrics`、`ReaderSurfaceResolvers`、`ReaderWidthClass`、`ReaderWindowMetrics`、`ReaderPressFeedback`、`ReaderSearchControlGeometry` 原路径移除。标准页、首页顶栏、返回栏和目录直连同一 [ReaderHeaderMetrics](../../entry/src/main/ets/ui/foundation/ReaderHeaderMetrics.ts)，标题高度仍由实际测量替换初始值。 |
| 9 项公共控件与必要适配迁入 `ui/controls` | `ReaderActionAccessibility`、`ReaderButton`、`ReaderIconButton`、`ReaderLabeledIconAction`、`ReaderLabeledIconActionSpecs`、`ReaderToggle`、`ReaderSegmentedControl`、`ReaderFormField`、`ReaderChoiceRow` 原路径移除。书架设置实际使用开关与短枚举，设置使用同一开关和表单行；选择面板直接消费 `ReaderChoiceRow`。详情的章节预览继续持有原章节意图，共用动作语义。 |
| 4 项公共依赖归位 | `SurfaceHorizontalGeometry` 和 `ReaderFloatingBarMetrics` 迁入 `ui/layout`，`ReaderControlSpecs` 和 `ReaderMessageStyle` 分别迁入 `ui/controls` 与 `ui/foundation`。搜索几何调用方直连 `ReaderSearchControlGeometry`，旧转导出移除。依赖检查对 `ui` 按整个 `features` 目录判定，涵盖旧 `features/common`。 |
| 3 项功能视觉资产归还原业务 | `ReaderMangaDownloadPopup` 与其规格迁到 `features/manga`，[BookDirectoryPage](../../entry/src/main/ets/features/reading/ui/BookDirectoryPage.ets#L711) 调用功能弹层。`SharedDownloadVisualSpec` 迁到 `features/downloads`，由下载页和 `DownloadTypography` 消费。基础 `ReaderTypography` 无下载视觉规格导入。 |
| 2 项旧规格文件退役 | `ReaderSwitchSpecs` 的受控开关与分段显示规格内置于 `ReaderToggle` 和 `ReaderSegmentedControl`。`ReaderChoiceSpecs` 的现用行规格内置于 `ReaderChoiceRow`，由 `ReaderSelectPanel` 和保留的 `SettingsSelectOverlay` 调用。两个旧生产文件均已移除。 |
| 保留文件中的旧出口 | `ReaderPageShell.readerStandardPageContentStart` 已移除，标准页把间距交给 `resolveReaderPageGeometry`。`ReaderHeaderSpecs.DirectoryHeaderSpec` 及其固定定位计算、圆角字段已移除，[ReaderFullDirectory](../../entry/src/main/ets/features/reading/ui/ReaderFullDirectory.ets#L119) 只保留自己的尺寸输入，位置及外框分别使用 `ReaderPageGeometry` 和 `ReaderPanelFrame`。`DetailHeaderSpec.contentStart` 已移除，书籍详情的 Scroll 只读取其已解析快照的 `content.startInset`。 |
| 旧顶部栏高度别名 | `ReaderFloatingBarMetrics.READER_FLOATING_TOP_BAR_HEIGHT` 已移除。生产标准顶栏回退使用 `ReaderHeaderMetrics.APP_HEADER_BAR_HEIGHT`，底栏尺寸及避让由 `ui/layout/ReaderFloatingBarMetrics` 提供。 |
| 旧搜索及标准顶栏回退 | `ReaderHeaderSpecs.readerSearchHeaderHeight` 和 `readerPageInitialHeaderHeight` 的 `standard`、`home` 分支已退役。书架仍用 Library 顶栏初值，搜索结果从 Library 的实际测量交接取得高度。标准页直接使用公共 `APP_HEADER_BAR_HEIGHT` 首帧回退。 |
| 原列为退役但仍有消费的规格 | `ReaderControlSpecs` 在 `ui/controls` 继续提供按钮、图标动作、表单和搜索行所用的有限规格，已移除旧路径和几何转导出。`ReaderLabeledIconActionSpecs` 仍由同族渲染器导入。两项的剩余规格继续按第 4 节的真实消费者迁出条件处理。 |
| 当前无生产静态导入的保留项 | `CachedBookIdentity` 继续 `DEFER`。仍须按原条件核对真实缓存身份与 Core 事实的关系。文件存在和历史测试均不计作可见覆盖。 |
