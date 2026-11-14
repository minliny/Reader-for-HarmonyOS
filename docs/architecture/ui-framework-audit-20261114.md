# Reader HarmonyOS 全应用 UI 框架审计报告

本报告的审计结论绑定下述原始输入。2026 年 11 月 14 日用户授权后，已在原隔离检出全量实施。五项问题已有生产修改及准确局部回归，Toggle 键盘焦点风险已经定位并在后继候选 af920500e5af 上完成准确现有 VM 场景。用户随后要求先完成代码范围，再进入 VM 验证。当前代码续查已补详情、漫画目录、保留 Discover 的测量依赖，并在既有工具栏容量内为目录查询分配 44vp 响应。后继源码待完整工程编译及候选验证。

当前新增代码侧库存为 635 个生产文件，14 个 StandardPage 和 11 个 Scaffold 构造点的框架消费处置已对账。原始 633 项库存及审计结果保留历史身份。Source 重复动作的生产 owner 和上下文优先级已按原入口完成登记，正式检查现保留 37 项诊断。紧凑目录及 TTS 的其余 44vp 槽位冲突已有数值预算，用户已明确沿批准原稿保留这些紧凑布局及容量冲突。实际执行状态见实施方案“当前执行进度”和原账本 implementation 字段。[当前代码复核](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-first-review.json)

VM 补充发现 UIF-06。书源工具下拉靠近窗口底部时，末项被裁切，内部 Scroll 没有可滚动范围。原生 popup 包裹盒为零尺寸，ReaderSelectPanel 的绝对定位内容未参与平台避让。当前代码将 popup 内容改为自然流并支付当前窗口、安全区和 IME 高度预算，原有页面覆盖层继续使用定位宿主。新增 inline-popup-layout、原 overlay/motion 及边框父链回归通过，后继完整编译和原生底部避让复验正在推进。失败原始 UI 树与截图已保留在原账本。

日期为 2026 年 11 月 14 日。

当前框架存在五项新增开放问题。其中三项涉及生产接线或布局约束，一项涉及短反馈的无障碍宣告机制，一项涉及回归测试的判据。页头测量换代后的续接缺口按 P1 处理，其余四项按 P2 处理。历史控制栏问题已能追到明确代码链，当前生产源码包含对应修复。连续绘制、完整触摸与读屏、历史 Tab 坏态归因，以及部分整页批准依据仍有开放范围。

本报告按应用级全量范围编排。完整源码清单、共享框架分层、20 个路由值、4 个 manifest 根、历史整改项和剩余验证工作均有去向。具体结论标明源码、方法、既有交付记录或原生观察的证据层级。源码库存与 AST 装配发现提供防遗漏范围，各页面全部运行状态的逐项原生验收仍待完成。配套修改步骤见[实施方案](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/docs/architecture/ui-framework-implementation-plan-20261114.md)。

## 审计基线

| 项目 | 本次绑定 |
| --- | --- |
| 工作区 | `/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112` |
| HarmonyOS HEAD | `10a5d58d0231f48a4c4fceff22c733b3b3cb1fe2` |
| Core HEAD | `c078126376294faa3a611690fbe48e79f0f86cc4` |
| Reader UI HEAD | `f206f0db011ae82c5a6e4059769fa3688b9cfcd5` |
| Git 状态 | 本轮文档写入前，上述三个检出均无已跟踪差异 |
| 产品档位 | `ReaderProductScope` 固定为 `l0` |
| 产品版本 | 最近可追溯交付记录为 HarmonyOS `0.2.0`，安装计数器 `1000000` |
| 源码库存 | `entry/src/main/ets` 下 268 个 ETS 和 365 个 TS 文件 |
| 公共 UI 库存 | `entry/src/main/ets/ui` 下 90 个文件，其中 layout 目录 16 个 |
| 源码检查范围 | 公共框架职责、正常装配入口、所追踪的页面和平台调用链 |
| 本轮运行证据 | 两项隔离的真实方法或 SDK 装配见证 |

源码指纹与共享构造点保存于[完整清单](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/source-inventory.json)。清单中 268 个 ETS 的解析诊断为零，这一结果只约束解析阶段。

最近可追溯交付记录指向生产提交 `45f30d329dfd0d85b40d64873e0211d5b672275d`、App `0.2.0.DEV.23dcb7399460` 和签名 HAP SHA256 `bbdd870611df0b1debf9a2a4f5e3543cb7632eafb4b5f51ccb0308cf7a11e136`。该记录含保数据部署、普通 Back 和目录往返的有限后证。本报告沿用其原范围，当前设备现场状态需要对应动作时再核验。[交付记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/control-module-height-20261113/goal-completion-audit/current-delivery-23dc.json)

## 结论与问题索引

| 编号 | 优先级 | 发现 | 当前证据 | 主要影响 |
| --- | --- | --- | --- | --- |
| UIF-01 | P1 | 环境换代退休页头回执，原生盒保持原样时缺少新回执续接 | 源码及真实方法见证 | StandardPage 的正文避让，同型直接宿主 |
| UIF-02 | P2 | 九个公共下拉构造点漏传减少动态效果 | 全树构造点及正常 SDK 装配见证 | 下载六处、书源工具两处、目录规则一处 |
| UIF-05 | P2 | 书架分组恢复提示缺少覆盖层高度边界 | 正常入口及组件容量分支 | 短窗口、大字号、展开长未决文案 |
| UIF-03 | P2 | 自绘短反馈缺少显式自动宣告通道 | 共享宿主及生产调用检索 | 保持原焦点时的短反馈可获知性 |
| UIF-04 | P2 | modifier 次数负例缺少行为失效依据 | 测试源码及官方平台约定 | 公共控件回归结论的可信度 |

UIF 编号延续上一轮账本。排序按处理优先级与生产影响排列。原生是否出现某个具体坏态，按各项列出的剩余问题判断。[机器账本](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/ledger.json)

## 框架各层的责任和审计处置

| 框架层 | 当前主要 owner | 核对内容 | 处置 |
| --- | --- | --- | --- |
| 根装配与产品准入 | Index、ReaderProductScope | 生产与诊断根、L0 路由条件、覆盖层相邻关系 | 20 个路由值和 4 个根均列入下文 |
| 路由与返回 | ReaderNavigation、各 Journey | 原来源、代次、临时 Back、保留阅读和平台窗口先后 | 所追踪链未新增确定的路由错误，完整状态组合仍需对应场景证据 |
| 页面几何 | ReaderPageGeometry、StandardPage、直接页面 owner | 正文唯一几何 owner、头尾和 rail、局部视口 | UIF-01，保留现有几何职责划分 |
| 原生测量 | MeasurementStore、FixedHeaderHost、SurfaceRectMeasurement | 回执身份、单位、换代、相同盒续接 | 拒旧已存在，续接存在 UIF-01 |
| 滚动 | PageScrollHost、ScrollLayout、原生 List 和目录列表 | start/end inset、短内容、锚点、实际滚动 owner | 历史短内容原点修复保留，动态场景按影响复验 |
| 表面与材料 | Dialog、Bounded、Panel、Raised、Tab | 绘制盒、边框、内容盒、裁切、阴影和宿主坐标 | 历史表面修复列入对账，分组覆盖层存在 UIF-05 |
| 公共输入与选择 | Button、FormField、Select、Toggle、SegmentedControl | 受控值、动作资格、真实 carrier、原生实例 | UIF-02，Toggle 焦点连续性列为条件风险 |
| 窗口与安全区 | WindowCoordinator、WindowMetrics | 密度、字号、IME、系统栏、配置发布和串行策略 | 配置变化是 UIF-01 的触发入口之一 |
| 字体与主题 | Fonts、FontLoadHost、Typography、ThemeRegistry | 文件就绪、样式角色、真实量字、主题输入 | 当前 checked font 路径继续使用，完整字形矩阵按原记录开放 |
| 动效 | MotionPolicy、MotionSpec、Clock、SelectPanel | 全局偏好传播、时钟、迟到完成回调 | UIF-02，实际连续绘制仍有开放范围 |
| 消息 | Transient、Recovery、PageState、NativeAlert | 分类、前景宿主、原操作身份、容量、宣告 | UIF-03、UIF-05 |
| 验证与登记 | SDK probe、页面 register、装配检查 | 正常入口、真实 producer、负例、结果范围 | UIF-04 及既有证据缺口 |

16 个 layout 文件的现有职责划分有对应消费者。当前所追踪的调用链支持保留 TS 几何与 ETS 原生边界、共享 Scaffold 与 StandardPage、独立测量存储和滚动投影。修复应落在具体错误依赖与接线上。[几何宿主合同](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/docs/architecture/page-geometry-host-contracts-20261111.md)

### 公共源码分组与审读证据

| 分组 | 文件数 | 本次重点 | 结论或后续 |
| --- | --- | --- | --- |
| chrome | 3 | App、返回及阅读顶栏与原生页头组合 | 对照页头测量与父子盒，纳入 UIF-01 影响分析 |
| controls | 18 | 公共输入、选择、Button、Toggle 与 FormRow | UIF-02、UIF-04，Toggle 焦点风险 |
| feedback | 7 | 短反馈、恢复、PageState 及多事项组合 | UIF-03、UIF-05，沿原业务身份与类别接入 |
| foundation | 28 | 窗口、字体、主题、配方、动效与单位 | UIF-01、UIF-02，原生字形与全动作时序仍开放 |
| layout | 16 | 几何、测量、滚动投影、宿主和原生 frame | UIF-01，16 个职责与输入哈希见覆盖快照 |
| patterns | 2 | Tab 和无封面组合 | Tab 应用层修复已有，历史坏态因果仍开放 |
| platform | 5 | 原生确认、窗口、Web 和字体宿主 | 平台生命周期沿已追踪入口使用，完整系统交互待对应证据 |
| surfaces | 11 | bounded、dialog、raised、panel 与材料 | 保留表面职责，分组临时恢复容量单列 |

这些文件数来自全部路径与哈希清单。语义结论对应账本内明确列出的方法、装配和调用链。每个文件的库存归属与 16 个 layout 的责任存入覆盖快照，完整逐页状态空间、性能指标与原生资源释放的量化结论仍待各自证据。

### 排除的候选问题

- ReaderFormField 的两次 attributeModifier 支持合法顺序组合，生产缺陷判断已排除。UIF-04 保留的是当前负例缺少行为失败依据。
- SurfaceRectMeasurement 的位置单位已对照本机 SDK。FrameNode 位置为 vp，当前尺寸转换路径的已审部分没有建立重复缩放原因。
- 通用 pageVisible 的透明度属性不足以确定隐藏阅读泄漏输入。实际 Index、ReaderShell 和阅读装配具有前景、输入与 accessibility 围栏，已追踪调用链未建立该项可达缺陷。

候选原因和排除依据保存在[原问题账本](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/ledger.json)。

## 页头测量换代后的续接缺口

### 原因与触发条件

UIF-01 的触发前提是已采纳页头高于回退值 58vp，随后某次环境或局部视口变化递增 `measurementKey`，而页头自身的原生尺寸和位置保持原样。较大字号、复合页头以及只改变窗口高度或键盘事实的场景需要重点检查。

`ReaderStandardPage.onLayoutInputsChanged` 递增 key。`headerHeight` 随即通过 `readForGeneration` 读取新代事实，旧回执失去资格，结果回退为 58。`ReaderFixedHeaderHost` 仅在 `onAreaChange` 中发布高度，key 变化自身没有主动读取当前盒或续接相同盒回执。本机 SDK 将该事件定义为布局引起的尺寸或位置变化，重新绑定回调没有提供一次必达的新尺寸回执。[失效与读取](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/ui/layout/ReaderStandardPage.ets:55) [原生回执入口](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/ui/layout/ReaderFixedHeaderHost.ets:15) [SDK 事件语义](/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/component/common.d.ts:20037)

### 已得到的见证

已有测量输入为页头 93vp、页脚 84vp，正文 startInset 为 101vp。保持宽度、字号和页头原生盒，改变窗口高度与键盘事实后，真实方法将页头读数改为 58vp，正文 startInset 改为 66vp。93 是显式有限回执输入，见证没有执行原生布局调度。页脚可能因位置变化获得新 Area，持续缺口结论约束保持原盒的页头。[方法结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/standard-page-witness-02.json)

### 影响与关闭条件

StandardPage 有 14 个构造点。设置、书架设置和管理、书源工具共享该机制，保留的 RSS 和 Sync 标准页也消费它。SourceManagementPage 另有同型失效和 Area-only 发布结构。其他直接 owner 使用不同的 fallback 与身份策略，应逐个核对，不能仅凭使用同一个 store 就判为相同坏态。[书源同型路径](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/features/source/ui/SourceManagementPage.ets:1320)

关闭要求是在原生盒保持原样时得到当前事实或合法复用既有事实，同时继续拒绝真实宽度、字号、实体或挂载已经失配的旧回执。旧测试手动注入每一代的新回执，其通过结果保留拒旧和收敛范围。[现有测试](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/tools/test-ui-window-layout-closure.mjs:44)

## 减少动态效果的调用方遗漏

### 原因与影响面

UIF-02 来自全局偏好和公共组件之间的接线遗漏。SettingsPresentation 已发布偏好，ReaderInlineSelect 的 `reduceMotion` 默认 false，并将该值传给触发器和面板。全树 AST 发现 9 个生产构造点，均未提供此 Prop。

| 文件和分支 | 构造点 |
| --- | --- |
| SharedDownloadPage | 784、1308、1326、1422、1436、1533 行，共六处 |
| SourceToolsPage 的 debugCard | 792、802 行，共两处 |
| ReaderDirectoryRules 的规则边界选择 | 293 行，一处 |

下载页已有 reduceMotion 输入。SourceJourneySurface 已有该输入，其 toolsPage 没有向 SourceToolsPage 传递。目录规则链需要沿实际目录 Destination 和 FullDirectory 补齐偏好输入。SourceJourneySurface 的业务导航类与 UI 装配组件承担不同责任，Prop 修改应落在实际构造链。[全局发布](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/features/settings/presentation/SettingsPresentation.ets:60) [公共默认值](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/ui/controls/ReaderInlineSelect.ets:23) [书源实际装配](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/features/source/ui/SourceJourneySurface.ets:105)

### 证据与关闭条件

正常 InlineSelect build、触发器和 popup builder 已进入实际 SelectPanel。默认接线下 inline 和 panel 的 reduceMotion 均为 false，expandPanel 发出 160ms 动画参数。平台弹出窗口和动画像素保持独立证据范围。[SDK 结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/inline-select-witness-02.json)

已有 `inlineSelectSdk.choose` 在选择前主动把 reduceMotion 设为 true，不能用其选择结果代替真实调用方的偏好传播。关闭需要覆盖全局 true 和 false、菜单打开中途切换、关闭完成回调、旧 identity 和卸载。[辅助方法](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/tools/lib/reader-inline-select-sdk-probe.mjs:41)

## 分组恢复提示的覆盖层容量

UIF-05 的正常路径为 Index 的 BookshelfGroupDialog、surface、recovery 和 ReaderRecoveryNotice。分组 owner 的 recovery 可以把 blocked mutation 的消息接入原操作提示。

surface 中的顶部 Column 没有剩余高度约束或 Scroll。recovery 未传 maxHeightVp，共享 Notice 使用默认 -1，走自然高度分支。展开后文字上限为 10000 行。长未决文案、短窗口或大字号时，当前装配缺少完整阅读和恢复动作可达的布局保障。具体原生裁切位置仍待对应场景观察。[覆盖层](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/features/bookshelf/ui/BookshelfGroupDialog.ets:39) [Notice 构造](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/features/bookshelf/ui/BookshelfGroupDialog.ets:95) [容量分支](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/ui/feedback/ReaderRecoveryNotice.ets:52)

共享 Notice 的自然高度适用于已有内容流消费者。该项应由分组覆盖层支付当前可用高度，沿用共享组件已有的有界滚动能力。关闭条件包括展开长文案、零剩余空间、双动作 busy、原 generation 回调、外点与 Back、焦点返回及分组事务身份。

## 短反馈的无障碍宣告

UIF-03 已确认应用侧缺少显式宣告通道。ReaderTransientFeedback 发布内容、tone、可见性和 generation。ReaderTransientToast 用普通 Text 呈现并定时收起，当前宿主没有自动宣告声明。完整生产检索未找到 accessibilityLiveRegion、sendAccessibilityEvent 或 announceForAccessibility 调用。[共享反馈](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/ui/feedback/ReaderTransientFeedback.ts:98) [真实宿主](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/ui/feedback/ReaderTransientToast.ets:66)

系统是否通过其他事件读出特定 Text，仍待原生读屏观察。当前源码无法保证用户保持原焦点时及时获知短反馈。关闭需要在实际有效前景宿主按当前 generation 宣告一次，处理替代、重复、后台和卸载，并保留原焦点。SDK 已提供 sendAccessibilityEvent、announceForAccessibility，以及 API18 起的不打断宣告事件，可以复用平台能力。[本机 SDK](/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/api/@ohos.accessibility.d.ts:96)

## modifier 负例的证明力

UIF-04 位于 `assertSingleNativeModifier` 和对应负例。测试要求调用次数等于一，加入第二个 modifier 就被拒绝。该断言可以检查特定局部封装约定，其结果不能独立证明属性、几何或业务行为已经失效。[测试断言](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/tools/test-framework-confluence-controls.mjs:25)

华为文档支持同一组件顺序应用多个 modifier，并按后写覆盖同名属性。公共输入框当前的双 modifier 可以合法组合，已从候选生产缺陷中排除。需要补充的证据是最终属性、更新后的语义、禁用与按压状态、真实回调，以及会实际破坏这些结果的负例。[官方约定](https://developer.huawei.com/consumer/en/doc/harmonyos-guides/arkts-user-defined-extension-attributemodifier/)

## 条件风险与证据缺口

| 项目 | 已知事实 | 待回答的问题 | 当前处置 |
| --- | --- | --- | --- |
| Toggle 焦点连续性 | 每次有效 native change 都递增 nativeRevision 并更换原生 Toggle，用于恢复受控值 | 键盘及读屏焦点在该原生实例替换后是否连续 | 保留风险，先审现有证据，再选最小原生场景 |
| 移除确认的高度更新 | BookRemovalDialog 的 messageMaxHeight 读取窗口事实，父级缺少窗口 revision 依赖 | 纯高度变化时是否由原生父约束或文字 Area 保证容量更新 | 保留风险，源码没有证明必然裁切 |
| 全动作连续绘制 | 已有 settled 帧、有限过渡和 SDK 方法证据 | 全模块点击是否存在原生中间坏帧及准确时序 | G05 开放，需可用的连续取帧入口或现成视频 |
| 历史 Tab 扇形 | 应用层零宽绘制与 Area/clip 缺口已修，后继正常像素和 RS 已记录 | 历史坏态的 Area、半径、inner path、DrawCmd 与帧时序 | G10 开放，缺同 App/PID/window/frame 的坏态事实 |
| 完整命中与适配 | 正式登记的 E2/E3 仍有失败或未运行 | 各实际目标父预算、相邻命中和真实大字号是否成立 | 按准确页面和变体关闭 |
| 整页视觉批准 | 部分独立原稿及后继批准可用，Figma 部分页面带源码衍生标记 | 书架、搜索、详情及部分二级/漫画状态的完整批准组合 | 来源登记保持 OPEN_APPROVAL |

Toggle 和移除确认的原生后果尚未建立，实施方案安排有界定位步骤。G05 和 G10 分别需要当前连续绘制证据与历史坏态同期数据，普通后继正常帧只能证明其采样时刻。[风险源码](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/ui/controls/ReaderToggle.ets:43) [移除高度](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/features/bookshelf/ui/BookRemovalDialog.ets:68) [既有开放项](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/docs/architecture/ui-design-full-fix-20261113.md:455)

## 历史控制栏根因的当前对账

| 原因族 | 历史证据 | 当前源码处置 | 剩余关闭范围 |
| --- | --- | --- | --- |
| 活动内容决定公共外壳 | chooser 直接消费当前 minimum/chrome | sharedShell 用于公共选择，模块 minimum 继续用于内容适配 | 全状态连续画面及真实环境变更 |
| 页面语义先于完整 profile | 新模块先挂载，后登记并采纳测量 | 准备目标 facts/profile 后共同提交 session 与 receipt | 原生调度和连续绘制 |
| 测量请求代次使有效输入失效 | provider bind 立即递增 generation | 已提交 receipt 与待测请求分离 | 全部真实控制动作和临时层时序 |
| Home 的 Scroll/direct 双树 | 阈值两分支分别装配 homeContent | 单一 Scroll owner，切换滚动资格 | 真实滚动、焦点和动态字体 |
| 触控下限进入 paint/slot/坐标 | 31536cfb 等历史改动 | 默认配方与响应分配已分开 | 紧凑横向目标仍有 E2 冲突 |
| 705 变为通用优选比例 | 安全区特例写入比例常量 | 原参考 736 与真实物理约束分开 | 不同窗口、安全区端点 |
| 父子内容盒与边框欠账 | d8 检查点及前后 Git blob | 内容盒扣边框，真实组合支付完整高度 | 对应窄宽、大字号和像素边界 |
| 重复描边与 Full actor 错绑 | 公共/私有表面同时绘制，Full stroke 读 moving content | 表面 owner 分配，Full fill/stroke 使用同源 actor | 连续多进度原生绘制 |
| 异步导航后的读取时机 | Replace 入口请求切页后立即读取 | 完整提交后沿原 owner 启动读取 | 非空、失败及写入恢复的准确分支 |
| 失活 intent 消费 Back | 仅因对象存在返回 consumed | 清理旧对象，消费资格由 active intent 决定 | pending hide/open 竞态的原生问题仍按方法证据边界 |

`31536cfb` 是触控下限传播链的重要合流点。目录最终宽高及部分预算来自多个提交的累计变化，具体数值需要绑定相应 Git blob、宽度、字号和文案。每次原生闪烁与上述更新的逐帧对应继续沿 G05 保留，现有代码链已建立机制和可达中间状态。

这些改动及选定原生观察见[当前修复记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/docs/architecture/ui-design-full-fix-20261113.md:202)。历史 d8ad88ef 是已有 WIP 的检查点，Git 证明父提交到检查点的差异，具体编写会话继续保留边界。历史尺寸表中的 236 和 238 表示自然内容高度需求，参考条件为特定宽度、1× 字号与基线文字包络。

## 既有全应用设计问题的当前对账

下表对账 2026 年 11 月 13 日的 15 个整改条目。当前源码变化与既有记录支持的有限结果分别沿原来源使用。整页 visual 的关闭状态见后文。

| 旧编号 | 原问题 | 当前处置 |
| --- | --- | --- |
| S-01 | 恢复提示间隔、下划线、误判展开 | 当前 Flex 含 18/6 间隔，标题自身量字决定展开，动作使用 notice 配方 |
| RD-03 | TXT 规则恢复提示推移表单 | ReaderFullDirectory 使用独立有界 Scroll 覆盖槽，表单有独立滚动体 |
| RD-04 | TTS 恢复提示进入表单流 | windowModal 下使用独立恢复覆盖层并支付剩余高度 |
| RD-05 | 阅读恢复卡自动持续遮挡 | 当前显式请求后展示，控制栏和其他前景占用时暂退，正文布局独立 |
| P-01 | 下载行被三个 44 高纯信息区撑大 | 当前普通行按 bookTop/source/status 等角色分配，自然文字高度参与增长 |
| RD-01 | 默认目录工具栏强制 stacked | 默认 paint 与输入配方已恢复，窄宽和响应可行性单独判断 |
| RD-02 | Full 标题与目录 Tab 常态增高 | 共享标题绘制 30 与响应角色分开，各模块预算保留 |
| RD-07 | 书签空态和失败态配方丢失 | 当前使用 readingBookmark 变体 |
| RD-08 | 秒数按钮名称与五秒行为冲突 | 当前名称为增加或减少五秒，分钟分支为五分钟 |
| S-02 | App 主题标签横向预算不足 | ReaderFormRow 依据真实宽度和量字决定上下排，使用 168 的单一控件宽度源 |
| S-03 | 书源统计固定单行 | 当前 statsRow 支持 BREAK_WORD，自然增长 |
| S-04 | 四个纯统计各占整行 | 当前 batch summary 使用可换行 Flex |
| S-05 | 多事项各画完整卡 | 当前 RecoveryGroup 持有共同表面，条目保留独立身份和分隔 |
| P-02 | 书架更新徽标缺宽度预算 | 当前按封面宽扣减后限制文本与外框宽，保留可访问完整计数策略 |
| P-03 | 导入进行态固定 228 | 当前自然内容测量、有界 Scroll、可用高度夹取及旧代回调围栏 |

以上处置的来源为[原审计](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/docs/architecture/ui-design-comparison-audit-20261113.md)与[修复及后继审修记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/docs/architecture/ui-design-full-fix-20261113.md)。本次抽查的当前正常入口包括 ReaderFullDirectory.directoryRulesLayer、TtsConfigOverlay.build、LocalReadingExperience.readerRecoveryContent、Source stats/summary、LocalImportDialog.importingPanel 和 Settings 的主题行。

保留条目 S-06 涉及 RSS/Sync 恢复动作装配，其产品准入继续由 L0 与实际恢复入口控制。原 UI 差异记录、独立批准来源、源码衍生画板和后继实施决定保持各自来源，任何新的尺寸归一都需对应到明确业务或设计依据。

## 全部路由值和页面根的处置

ReaderRoute 声明 20 个值。以下表格说明现有装配与本报告关联，路由声明自身不产生一个日常入口。

| 路由值 | 当前宿主或状态 | 关联审计范围 |
| --- | --- | --- |
| bookshelf | BookshelfScene/Shell，populated、empty、status 分支 | 单一正文几何、筛选、继续阅读、导入、分组、移除，UIF-05 |
| search | ReaderLibrarySearchSurface + SearchPage | 外部页头、查询/结果 owner、列表恢复、来源页往返、临时面板 |
| detail | LocalBookDetail 及原阅读返回上下文 | 顶部 Hero、Scroll、目录入口、在架状态、恢复消息 |
| reading | ReaderShell + text 或 manga actor | 控制栏体系、正文、保留实例、媒体及输入生命周期 |
| directory | ReaderDirectoryDestination，text/manga，detail/reader 两来源 | 头尾预算、目录状态、规则编辑、返回、UIF-01 同型审查与 UIF-02 |
| downloads | SharedDownloadPage，普通/管理/章节及弹层 | 响应角色、停留状态、原操作、六个下拉遗漏 |
| source | SourceJourneySurface + SourceManagementPage | 查询/筛选、统计、行、平台登录、恢复，UIF-01 同型路径 |
| sourceTools | 同一 Source journey 下的 Tools owner | 批量、检测、编辑、导出、日志，UIF-01 与 UIF-02 |
| settings | SettingsScenes/Shell/Page | Home/General/About/Developer/消息预览，UIF-01，偏好发布 |
| bookshelfSettings | BookshelfSettingsPage + StandardPage | 受控开关、分段、读取和未决状态，UIF-01 |
| bookshelfMultiSelect | BookshelfMultiSelectPage | 原生 List、选择页头与移除 footer、实体与代次 |
| bookshelfManagement | Index 保留管理分支 | 保留入口与归属 owner，日常可达性由真实调用方判断 |
| rulesManagement | Index 保留全局规则分支 | 规则表单与回执，普通入口按产品准入判断 |
| discover | product gate 关闭的保留实现 | MainTabShell 下正文与头尾，开放时需补验证 |
| rss | product gate 关闭的保留实现 | MainTabShell 下 RSS 主列表 |
| rssSubscriptionManagement | product gate 关闭的保留实现 | 标准页、选择及恢复 |
| rssSubscriptionEditor | product gate 关闭的保留实现 | 表单草稿、保存及输入 |
| rssSourceFeed | product gate 关闭的保留实现 | 标准页、列表与状态 |
| rssEntryDetail | product gate 关闭的保留实现 | 标准页、正文与 footer |
| sync | 新入口 product gate 关闭，历史恢复语义单列 | placeholder/StandardPage，历史恢复按实际入口审查 |

manifest 的四个根为 Index、ReaderStartupRecovery、ReaderRendererPilot 和 ReaderPageStructureVerification。前两者承担生产主根与启动兜底，后两者承担诊断或 DEBUG 验证。诊断 Builder 的直接调用证据须同时给出实际 build 装配链。[根清单](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/resources/base/profile/main_pages.json) [产品准入](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/app/ReaderProductScope.ts)

## 正式登记和证据状态

当前 register 为 Source、Directory、Downloads、Tools 四族，含变体共 21 项。21 项 visual 均为 NOT_RUN，21 项 interaction 均为 FAIL。adaptation 有 5 项 FAIL，其余 16 项 NOT_RUN。这里是机器登记当前保存的结果，不等于本轮重新运行了对应检查。[正式登记](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/tools/page-structure/register.json)

16 层登记的完整结果展开如下。PASS 保持登记内原有的有限依据，部分 FAIL 表示完整证据尚未闭合。

| 层 | PASS | FAIL | NOT_RUN |
| --- | --- | --- | --- |
| route | 0 | 0 | 21 |
| scaffold | 7 | 0 | 14 |
| informationArchitecture | 0 | 0 | 21 |
| header | 0 | 0 | 21 |
| scroll | 0 | 0 | 21 |
| content | 0 | 1 | 20 |
| query | 4 | 0 | 17 |
| footer | 0 | 0 | 21 |
| overlay | 0 | 0 | 21 |
| states | 1 | 0 | 20 |
| visual | 0 | 0 | 21 |
| interaction | 0 | 21 | 0 |
| adaptation | 0 | 5 | 16 |
| accessibility | 0 | 0 | 21 |
| measurement | 7 | 0 | 14 |
| dataLifecycle | 0 | 0 | 21 |

Source 的 content FAIL 保留了整页原生字形、裁切与内容验收缺口。其现有局部 SDK 已覆盖安全宿主和增长父级，完整原生结论仍开放。interaction 的登记包含完整命中、焦点与读屏覆盖不足，adaptation 的登记包含准确系统倍率及完整页面适配不足。具体 knownGap、证据及 followUp 保存于原 register 和本次快照。

既有总诊断记录仍保留 39 项，其中 E2 21 项、E3 5 项，另有 13 项 NOT_RUN。目录及 TTS 的部分紧凑横向响应小于 44，属于已知约束冲突。关闭时需同时核对原稿密度、父级预算、相邻命中和实际响应，不得只用外部 Common 的大小替代原生目标。[当前约束记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/docs/architecture/ui-design-full-fix-20261113.md:242)

## 实施后需要覆盖的状态

| 维度 | 必要场景 | 与问题的联系 |
| --- | --- | --- |
| 测量身份 | 同盒换代、真正宽度变化、字号/字体就绪、实体替换、卸载重挂 | UIF-01 与迟到回执 |
| 窗口 | 正常竖屏、320 宽、横屏短窗、现有 VM 分数密度、纯高度变化 | 几何、物理像素与可用容量 |
| 字号 | 1、1.3、1.6、2 的代码场景，设备实际支持倍率另记 | 当前消费者预算及字体策略 |
| 输入 | 原生点击、键盘激活、焦点、IME、Back、外点 | 资格、控制权、短窗可达性 |
| 状态 | loading、empty、error、partial、pending、blocked、busy、disabled | 消息类别和实际条件模板 |
| 切换 | 请求中换页、同实体重开、换书、隐藏保留、前后台 | 请求身份、有效呈现和迟到回调 |
| 消息 | 短/长、单/双动作、多事项、展开、替代、宣告 | UIF-03、UIF-05 |
| 动效 | 偏好 true/false、过程中改变、完成前退休 | UIF-02 与帧时序 |

具体修复只选择实际影响的场景。这个矩阵用于定义全应用审计范围与剩余证据，某一项失败也应先定位该项。

## 审计产物和后续关闭

- [完整问题账本](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/ledger.json)记录触发、原因链、源码行与 SHA、置信范围及两个保留风险。
- [源码清单](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/source-inventory.json)记录 633 个源码输入及所选共享构造点。
- [页头续接见证](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/standard-page-witness-02.json)和[下拉偏好见证](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/inline-select-witness-02.json)提供两项当前运行证据。
- [覆盖与状态快照](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/full-report-scope.json)记录路由、框架文件与当前 register 的展开结果。

首轮见证因夹具缺少 measureTextSize 而失败，补齐所需有限端口后完成两项见证，首次失败保留于账本。生产修复尚待按实施方案执行。本报告新增审计与方案文档，实施完成后应在原问题上追加实际修改、运行和交付证据。
