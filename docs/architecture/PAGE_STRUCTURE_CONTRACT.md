# Reader 页面结构契约（RPSCM v0.2）

> 2026-11-12 合流补充适用于本批新目录和运行时 owner。执行状态见 [合流实施记录](framework-confluence-20261112.md)，历史试点保留原输入与结果。

## 工程框架与页面契约的职责映射

页面的16层定义负责设计、选型、预算、登记及检查。工程目录的应用装配、业务功能、公共UI三层负责源码依赖和运行时所有权。开发时同时满足两组合同，页面仍沿ArkUI原生声明式装配。

| 合同范围 | 当前事实与实现归属 |
| --- | --- |
| 路由和返回 | app/navigation/ReaderNavigation保存唯一导航事实；具名Journey保存该旅程的有界展示状态；Index负责根装配及事件转交 |
| Source返回 | SourceJourneyPresentation保存同Runtime的查询、状态、分类、分组、有效锚点及Tools返回上下文 |
| 页面几何 | ui/layout/ReaderPageGeometry统一解析；StandardPage或具名领域页面拥有输入及当前代测量；Scaffold绘制已解析结果 |
| 窗口事实 | ReaderWindowCoordinator接收当前Ability/Window事实，ui/foundation/ReaderWindowEnvironment提供只读入口 |
| 控件及消息 | ui/controls与ui/feedback持有真实原生交互节点、语义及绘制；业务动作与原操作归原Host/Orchestrator |
| 领域内容 | feature内保留真实List、Tree、阅读和漫画实现，通过有限接口消费公共能力 |
| 机器登记 | tools/contracts与tools/page-structure分别记录上游owner和页面实例，引用当前文件、符号及修订 |

每页声明唯一主滚动owner。有界结果列表和领域模块的内部滚动分别登记其宿主、边界和返回关系。采用Native Button的动作直接在该节点支付尺寸、语义和派发；标签Text保留排版职责。

固定区域按当前测量代次支付避让。流内页头及普通dock由List消费，管理态固定dock按真实剩余内容预算准入。测量输入变化后只接受当前代回执，窗口配置中的fontSizeScale与Display的px/vp密度分别消费。

检查定义随当前装配重新审阅，保留能捕获原缺口的负例。输入指纹用于检测漂移。方法、SDK、Native、安装及用户证据各自归属其固定候选，发生职责或交互节点变化时按影响范围重新验证。

2026-11-13 的全页面代码审计补充以下装配约束。当前执行及独立验收范围见 [代码侧独立审计记录](code-side-ui-audit-20261113.md)。

- 自定义组件的外部 `__Common__` 分配和内部 Native 节点分别支付尺寸。等分槽位需要内部控件填满已分配宽度，父容器的 44vp 高度也需要核对实际可交互叶节点。
- 行预算使用实际宿主扣除安全区、padding、border、封面和固定动作后的剩余宽度。文字偏好最小宽度受实际剩余空间约束，动作可以换行，行高和虚拟化投影步长共同更新。
- 短视口给当前可交互内容保留完整目标空间。固定区域占满预算时按当前宿主采用有界文档滚动或模块滚动，保持同一业务 owner、动作与返回入口可达。保留但隐藏的实例同时退出输入、命中和无障碍遍历。
- 测量键包含宽度、字号、字体准备修订、内容与当前展示身份等真实输入。测量结果字段独立保存，首次冷测量及同一帧的多个合法回执可以依次发布。旧身份、旧宽度与退场实例的回执拒绝更新后继状态。
- 共享控件变更沿真实 composition 追踪消费者。检查记录区分路由页、嵌入模块、诊断页和保留禁用页，控件构造或模块发现数量单独记录其统计口径。
- 图标字形、可见背景、文字行盒和原生命中框分别保留各自的规格。扩大命中框时核对内部绘制居中、父级预算及相邻目标，逐一验证实际采用的 recipe 和默认变体。
- 稳定 key 保留的原生节点读取当前事实。选中、禁用、忙碌、末项分隔线等状态更新须验证同一节点及其真实事件回调，数组重新构造和初次挂载检查不能覆盖这条路径。
- 子组件 Prop Watch 或生命周期向上通知时，沿实际父链核对正在渲染的 View。需要延后父级发布的通知同时保留即时失效的输入准入，并在交付时核对原展示身份、代次和当前事实。组件自身的 State 更新按 SDK 的逐 View 渲染语义判断。
- 临时选择器打开时保留被覆盖页面的路由、实体和阅读 session。选中目标后的提交或预览由既有业务 owner 执行明确交接。恢复消息只投射原实体的事实，读取失败、已知结果和未知写入回执分别使用所属类别的公共宿主。
- 消息显隐、原操作回执及新写入准入分别消费业务 owner 的事实。跨实体共享的未决写锁通过独立只读准入传到实际写节点，原实体提示保持自身展示身份。首次读取已经产生的恢复回执也交付当前宿主，核对同一操作对象的后续变化能触发真实响应式发布。创建、删除及手势写入口共同核对准入，正文与目录的纯读取继续按各自资格执行。
- 阅读恢复浮层与正文分页、控制栏高度分别装配。浮层暂时退绘时核对真实 State 订阅及关闭后的重新显示，快捷目录和完整目录保留可浏览空间与原实体锚点。恢复提示的自然高度及变化不得隐式占满列表或重置当前章节定位。
- 数据类型未确认时保留准备状态，从既有数据 owner 取得类型事实后选择版式。兼容输入含缺失字段时，入口转换须验证旧数据及异步补型过程。
- 主列表在固定区与滚动前缀之间切换时声明当前位置交接。字号、窗口和前缀高度变化时以当前有效实体锚点恢复，用户继续滚动、退场和旧回调均有失效条件。
- Scroll的内容主轴对齐与子Column的内部排列分别核对。文档首区的位置同时包含容器对齐偏移、滚动偏移和已解析inset，短内容、长内容及内容更新都需符合该宿主的阅读起点。空态、横向控件和阅读专用宿主按各自语义登记，保留其有意居中与定位。

书源原始 JSON 编辑当前要求 `source.import.conditional.v1`，将读取时完整 `sourceVersion` 固定进原操作，并在 Core 事务内核对前态。条件导入省略 canonical rules 时保留同一前态的规则。缺少完整 raw BookSource 的旧来源由编辑读取入口返回格式限制，现有规则与草稿保留。§14.3 中早期试点的能力结论继续绑定其历史输入。

Builder slot 中依赖可变状态的 UI 控制流须放入具名 `@Builder`，由普通箭头转交，并核对真实编译输出包含结构化 `If` 观察与状态订阅。回归入口为 `node tools/test-reader-font-demand.mjs --case manga-publication`，覆盖初始准备态转入正文、页脚、覆盖层和页头菜单。


> 状态：v0.2，开发指导文档。不是发布说明，不是视觉规范。
> 适用：HarmonyOS ETS 页面；当前验收基线 366×844。
> 配套：结构问题修复实施方案 [`../issues/page-structure-fix-20261102.md`](../issues/page-structure-fix-20261102.md)。
> 更新：2026-11-12。当前装配、生产输入及执行结果见合流实施记录。§14.3 保留早期试点的原时点结果。

## 0. 文档定位

本文档回答三个问题：

1. 一个页面必须描述哪些结构事实；
2. 相同的业务输入应当推导出什么结构；
3. 什么结果算合规，什么差异是合法变体，什么差异是违规。

它覆盖开发全流程：需求评审、页面 Brief、原型选择、结构推导、登记、实现、检查、验收、变更。不同角色可以按以下顺序阅读：

| 场景 | 阅读顺序 |
|---|---|
| 新建页面 | 2 → 3 → 4 → 5 → 6 → 12.1 |
| 修改页面 | 12.2 → 6 → 7 → 9 |
| 代码评审 | 13 → 附录 A |
| 改共享组件 | 10 → 11 → 12.4 |
| 处理违规 | 7 → 11 → 12.5 |

本文档是**契约模型**，不是“设计语言”。只有做到“从 Brief 推导结构、判定合规、约束组件装配”三件事，才可以升级为页面结构语言。

### 0.1 范围

- HarmonyOS ETS 页面。
- 366×844 单尺寸基线；宽度矩阵、平板、横屏在基线验收后另行定义。
- 页面结构、页面级交互、页面级状态与实现契约。
- 页面与上游契约的引用关系：路由/返回、控件状态、无障碍、操作事实、平台宿主。
- 不覆盖：视觉重设计、新功能、业务规则、发布流程、跨平台一致性。

### 0.2 非目标

- 不替代组件规范。按钮、字体、颜色仍由既有组件与 token 负责。
- 不替代业务契约。数据身份、写入回执、恢复逻辑仍由 Host/Orchestrator 负责。
- 不替代上游框架。导航/返回、控件状态、无障碍、操作事实、平台宿主、消息分类与生命周期由各自 owner 维护；本模型只引用 ID、声明页面位置并检查引用完整性。
- 不要求所有页面立刻迁移。v0.2 只覆盖三个详细原型和书源页首轮闭环；其余页面按批登记。
- 不新增第 17、18 层。当前问题是组合与裁决，不是词汇不足；跨契约事实通过引用进入 16 层，不扩层。

### 0.3 与消息框架的关系

现有消息框架 [`../message-ui/FRAMEWORK.md`](../message-ui/FRAMEWORK.md) 与 `tools/message-entrypoints.json` 是层 9/10 的上游契约。本模型不重新定义消息分类、宿主准入、生命周期或业务 owner。

| 归属 | 本模型负责 | 消息框架负责 |
|---|---|---|
| 层 9 覆盖层 | 页面是否有浮层宿主、所在 slot、与页头/页脚/返回的层级关系、避让约束 | 业务事实属于哪一类消息、用哪个公共组件、当前宿主准入、更新/退休/去重、旧回调失效 |
| 层 10 状态 | 页面状态矩阵、状态转换、与内容区的关系 | 某事实进入 PageState、Toast、Recovery 还是 Alert；旧内容是否保留；busy/disabled 的原事实 |
| 登记 | 记录 `messageSurfaces` 引用、层级和检查方式 | 维护 `message-entrypoints.json` 的入口 ID、类别、准入和清理规则 |

冲突时，消息事实分类与生命周期以消息框架为准：页面结构不得把 Recovery 降级为 Toast，不得用全页错误态替换仍可用的旧内容。结构位置与避让约束由本模型声明，具体避让执行由消息宿主负责。页面结构登记只引用消息入口 ID，不复制第二套消息登记。

### 0.4 契约地图与上下游边界

本模型是“组合层 + 判定层”，不是所有框架的事实源。一个完整应用框架至少分为七个平面；页面结构只拥有 P2，其他平面以引用方式进入 16 层。

| 平面 | 契约 ID | 事实源/owner | 状态 | 与 RPSCM 的关系 |
|---|---|---|---|---|
| P0 产品与范围 | `product` | [ReaderProductScope.ts](../../entry/src/main/ets/app/ReaderProductScope.ts)、[PAGES_AND_STATES.md](../ui-design/cross-platform-reference/PAGES_AND_STATES.md) §1 | 部分 | 只引用可见路由集合；不定义能力开关或灰度 |
| P1 导航与路由 | `route` | [navigation-comparison.md](interaction-wiring-20261019/navigation-comparison.md)；[navigation-registry.json](../../tools/contracts/navigation-registry.json) | 部分 | 层 1 引用 `routeId`；不复制返回逻辑 |
| P1 启动与恢复 | `startup` | `PAGES_AND_STATES.md` §4、`ReaderStartupRecovery.ets`、`ReaderSystemFileOpenHost.ts` | 部分 | 层 1/10 引用启动、恢复和外部打开事实 |
| P2 页面骨架 | `page-frame` | [ui-page-framework-20261014.md](ui-page-framework-20261014.md)、`ReaderPageShell`/`ReaderPageScaffold` | 成熟 | 层 2/4/5 引用 |
| P2 参数/几何 | `geometry` | [ui-parameter-contract-20261025.md](ui-parameter-contract-20261025.md)、`ReaderPageGeometry`/`ReaderMeasurementStore` | 成熟 | 层 4/5/13/15 引用 |
| P2 表面/材质 | `surface` | [ui-surface-role-contract-20261028.md](ui-surface-role-contract-20261028.md)、`ReaderSurfaceSpecs` | 成熟（demo/设备待验） | 层 9/11/13 引用 |
| P3 视觉表达 | `expression` | `Reader-UI/theme/registry.json`、`ReaderTypography`、`SVG_PROVENANCE`、`MotionSpec`、[STYLE_AND_MOTION.md](../ui-design/cross-platform-reference/STYLE_AND_MOTION.md) | 成熟 | 层 11/12/13 引用 token/spec |
| P3 控件与状态 | `control` | [ReaderControlSpecs.ets](../../entry/src/main/ets/ui/controls/ReaderControlSpecs.ets)、`ReaderButton`/`ReaderFormField`/`ReaderChoiceRow`；[control-registry.json](../../tools/contracts/control-registry.json) | 部分 | 层 6/8/12/14 引用 `controlId` |
| P3 消息 | `message` | [FRAMEWORK.md](../message-ui/FRAMEWORK.md)、[message-entrypoints.json](../../tools/message-entrypoints.json) | 成熟 | 层 9/10 引用 `entryId` |
| P4 操作与投影 | `operation` | [ReaderOperationFacts.ts](../../entry/src/main/ets/app/ReaderOperationFacts.ts)、Hosts/Orchestrators/Projection | 部分 | 层 10/16 引用 `operationId` |
| P4 持久化/设置 | `persistence` | [Core 存储能力契约](../../../Reader-Core/docs/architecture/storage-capabilities-contract-20261110.md)、Settings owner | 成熟/部分 | 独立；页面只引用 |
| P4 平台宿主 | `platform` | [ReaderSystemFileOpenHost.ts](../../entry/src/main/ets/app/composition/system-open/ReaderSystemFileOpenHost.ts)、native Alert/登录 Web 宿主；[platform-host-registry.json](../../tools/contracts/platform-host-registry.json) | 部分 | 层 1/9/10 引用 `hostId` |
| P5 适配 | `adaptation` | `ReaderPageGeometry`、`ReaderLayoutCapability`、`ReaderSurfaceResolvers` | 成熟/部分 | 层 13/15 引用 |
| P5 无障碍 | `a11y` | 本文档 §6.10、E1–E6；独立审计待建 | 缺失/部分 | 层 14 引用 `a11y` block |
| P6 版本/签名 | `release` | [工作区治理](../../../AGENTS.md)、签名权威、当前 App release ledger | 成熟 | 独立，不进入页面判定 |
| P6 门禁/证据 | `gate` | [GATE_INDEX.md](../../../GATE_INDEX.md)、`contract-test-tiers.json`、`hap-contract-evidence-policy.json` | 成熟 | 独立，只报告结果 |
| P6 可观测性 | `observability` | 未正式化 | 缺失 | 后续；当前不阻塞页面 |
| P6 国际化 | `i18n` | 未覆盖 | 缺失 | 后续；当前不阻塞页面 |

契约地图规则：

1. 每个上游契约必须有 `contractId`、owner、source、machine source、status、consumedBy 和 referenceRule。机器索引为 `tools/contracts/contract-map.json`。
2. 页面登记中的 `routeContractRef`、`controlRefs`、`operationRefs`、`platformHosts.hostRef`、`layers.accessibility.facts.ruleRefs` 必须解析到契约地图和对应登记项；`messageSurfaces.entryId` 必须解析到 `tools/message-entrypoints.json`。悬空引用是 `FAIL`，不是 `NOT_RUN`。
3. 页面登记只存页面特有事实：位置、slot、层级、避让、状态投影、回程上下文。上游的分类、生命周期、几何公式、token 和宿主行为不在页面登记中复写。
4. 没有机器事实源的上游契约标记 `manual`；它不能用于宣称 L1 自动通过。
5. 同一事实只能有一个 owner。发现两个 owner 时标记 `UNRESOLVED`，不得在页面结构里新建第二个登记。
6. 冲突裁决见 §7.3；在各上游域内，以该域 owner 为准：消息分类/生命周期、路由/返回/保留、控件状态、平台宿主生命周期、几何/测量、表面材质分别由其契约决定。

v0.2 首轮只要求书源页实际用到的上游引用完整；未用到的契约先登记为 upstream，不建全量 registry，也不以空表冒充覆盖。例外是路由登记：路由 ID/父级是跨页事实，无法只登记一页，因此 `navigation-registry.json` 覆盖全部可见路由和保留路由；控件/平台宿主登记仍按页面最小集，不预建无消费者项。

契约地图最小形状（字段名以实际 schema 为准）：

```json
{
  "schemaVersion": "1.0",
  "contracts": [
    {
      "contractId": "route",
      "owner": "Index",
      "source": "docs/architecture/interaction-wiring-20261019/navigation-comparison.md",
      "machineSource": "tools/contracts/navigation-registry.json",
      "status": "partial",
      "consumedBy": ["source-management"],
      "referenceRule": "routeContractRef"
    }
  ]
}
```

`status` 取 `mature` / `partial` / `manual` / `missing`；`manual` 表示没有机器事实源，不能用于宣称 L1 自动通过。

### 0.5 平台继承与平台集成

平台继承是应用直接沿用 OS 已有能力，不重造；平台集成是应用把业务动作交给平台宿主完成，再接收结果。两者都不是应用页面。

| 概念 | 表面/生命周期 owner | 应用负责 | 页面登记 |
|---|---|---|---|
| 平台继承 | 平台 | 消费安全区、字体缩放、系统返回、读屏、生命周期，不重复实现 | 不登记为宿主；在层 13/14 记录适配事实 |
| 平台集成 | 平台或平台适配 owner | 发起意图、保存身份、接收结果、回程恢复 | `platformHosts` 引用 `hostId` + 页面 intent/return |
| 应用页面 | 应用 | 结构、状态、交互、数据 | `route` + 16 层 |

平台字体继承须贯通应用配置、初始 Configuration 和后续配置更新。应用按平台支持的方式声明 `followSystem`；当前窗口的有效 Configuration 字号事实由既有窗口 owner 消费，并核对窗口身份，拒绝旧窗口回调。Display 的 px/vp density 与安全区仍有各自事实源，不随字体倍率相乘；原生 fp 已跟随系统时，不得再把该倍率乘入原生字号。没有 Configuration 字号事实时采用的既有 fallback 必须明确登记，不能把 display density 当作已经收到系统字号更新的证据。

配置事实、几何预算和实际绘制分别验收。配置回调瞬间，已挂载宿主的 UIContext 读回仍可能处于上一轮布局；应在当前宿主稳定后记录实际 following/倍率读回、对应 revision 和真实字形。不得将目标倍率填进观测字段，也不得仅凭回调、字体注册调用或节点尺寸宣称字体已经正确绘制。平台返回的最大倍率是策略读回，不是已验证的渲染上限；未测倍率和其他页面的适配仍须保留边界。

常见平台宿主：

| hostId | 平台拥有 | 应用拥有 | 禁止 |
|---|---|---|---|
| `filePicker` | 选择器 UI、权限、取消 | 导入意图、目标、批次、回程 | 画进路由；自绘文件浏览器 |
| `loginWeb` | WebView、Cookie、宿主关闭 | sourceId/session、回程、结果核对 | 把登录页当应用页面；用当前页面猜结果 |
| `nativeAlert` | 弹窗、遮罩、关闭 | 原目标、世代、确认语义 | 页面再画同类 Alert |
| `share` | 分享面板、目标应用 | 分享内容、来源、回程 | 自建分享 UI |
| `mediaSession` | 系统媒体控制 | 播放状态、队列、中断策略 | 伪造系统播放态 |
| `externalOpen` | 系统打开方式、文件宿主 | 恢复屏障、导入/阅读准入 | 绕过启动恢复直接写库 |
| `permission` | 系统授权 UI | 请求时机、拒绝后的业务路径 | 用自定义弹窗冒充系统授权 |
| `backgroundTask` | 系统后台调度 | 任务身份、进度、取消 | 关闭页面即当任务取消 |

平台宿主规则：

1. 平台宿主不是路由，不进入 `navigation-registry.json` 的路由列表和返回栈；层 1 只用 `platformHostRefs` 声明关联。
2. 页面不得为平台表面再画背景、边框、圆角、遮罩或第二层外框。
3. `backPolicy` 默认 `unknown`，必须按宿主和平台验证；不得默认平台先行或应用先行。
4. 结果必须核对发起时捕获的 identity；旧 session、旧页面、旧世代的回调必须丢弃。
5. 不建空宿主。页面没有实际入口时，不登记 `filePicker`、`share` 等“以后可能用”的宿主。
6. 宿主登记是跨页契约；页面只存本次 intent、identity 和 returnContext，不复制宿主的关闭/权限/生命周期实现。
7. 平台成功不等于业务成功；原 owner 仍要核对 canonical 数据或回执。

书源页当前只登记实际存在的 `loginWeb`：`SourceOrchestrator.loginSource → ReaderRuntimeOwner.openSourceLogin → ArkWebExecutor.openInteractive`。JSON 导入是应用自绘 `JsonImportDialog`，不属于平台集成；文件选择器当前不是书源页入口，不建空登记。

## 1. 为什么需要这份契约

当前代码里，组件级规范已经不少：按钮有 spec，字体有 token，页面有 scaffold，浮层有共享外壳。但页面级装配仍由各页自行决定：

- 同样是“列表 + 筛选”，书源页把筛选放在滚动内容里，目录页放在固定页头里；
- 同样是“返回页头”，存在标准、浮动、漫画、自建等多种形态；
- 同一个业务动作，可能同时出现在页头、搜索行和页脚；
- 同一类空状态，有的页面区分“数据为空”和“筛选为空”，有的不区分；
- 字体放大后，有的页面有预算，有的直接溢出。

这些差异单独看都能解释，放在一起就没有可判定的规则。结果是：

- 新页面只能参考“看起来像”的旧页面；
- 修复一个页面容易破坏另一个页面；
- Review 只能凭经验，无法判断“这是合法变体还是违规”；
- 每次改版都容易变成重新设计。

本契约把这些隐含规则显式化，并把“页面作者的自由发挥”压缩到可解释的范围内。

## 2. 核心原则

1. **结构由 Brief 推导，不由审美选择。** 相同输入必须得到相同原型与层选择；差异必须由规则或例外解释。
2. **一页只有一个主滚动 owner。** 嵌套滚动必须有明确的手势优先级和边界，不能靠页面作者约定。
3. **固定区域必须支付 inset。** 固定页头支付 content start inset；固定页脚支付 content end inset；underlap 必须支付遮挡补偿。
4. **同一业务动作只有一个语义 owner。** 多入口允许，但必须有主次或上下文差异，并共享同一个 owner。禁止无差异、无主次、分别实现的重复入口。
5. **可筛选集合必须有“筛选为空 + 清除条件”。** “数据为空”和“筛选为空”是两种状态，不能共用一个泛化空态。
6. **状态必须显式声明。** 加载、刷新、空、筛选空、错误、部分失败、离线、未知回执，不能靠默认分支推断。
7. **状态不得只靠颜色。** 触控目标不小于 44vp 或提供等效 response region；正文/元信息对比度不低于 4.5:1。
8. **预算写成函数，不写常量。** 文字列最小宽度、trailing 上限、行高由原型、内容宽度、字号和内容优先级共同计算。
9. **例外必须有 owner、理由、补偿和到期条件。** 没有退出条件的例外不成立；例外不能复制到新页面。
10. **组件合规不等于页面合规。** 按钮符合 spec，不代表页面的滚动、页头、页脚、状态组合合法。
11. **消息分类和生命周期只有一个事实源。** 页面结构只决定消息表面的位置、层级和避让；事实归类、宿主准入、更新/退休和业务 owner 归消息框架。
12. **路由和返回使用进入时捕获的上下文。** 父级、来源、查询、筛选和回程目标不能从离开时的瞬时 route 推断。
13. **平台宿主不是应用路由。** 平台表面不画、不路由、不猜 Back；页面只登记发起身份、结果策略和回程上下文。
14. **页面只引用上游契约 ID。** 路由、控件状态、无障碍、操作事实、平台宿主的分类与生命周期不在页面登记中复制。

## 3. 模型总览

### 3.1 三段十六层

| 域 | 层 | 本层要回答的问题 | 登记字段 | 主要 owner |
|---|---|---|---|---|
| 结构 | 1 路由与返回 | 根/二级/详情/模态/阅读器？从哪来、回哪去、返回先关什么、哪些状态保留？ | routeContractRef / parentRoutes / entrySources / backPolicy / retention / systemBackOwner / restorePolicy / platformHostRefs | Index、PageBackBar、导航契约 |
| 结构 | 2 骨架 | 页面由哪些固定区域组成？ | prototype / regions | ReaderPageScaffold |
| 结构 | 3 信息架构 | 区块有哪些、什么顺序、首屏预算多少？ | blockOrder / firstScreenBudget | 页面 |
| 结构 | 4 页头 | 角色、呈现、组成、表面、高度与安全区 | role / presentation / composition / surface / height / controlRefs | PageBackBar、AppTopBar |
| 结构 | 5 滚动 | 谁是唯一主滚动？固定区边界？inset/underlap？位置恢复？ | owner / insets / underlap / restore | ReaderPageScaffold、ReaderPageGeometry、ReaderScrollLayout |
| 结构 | 6 内容单元 | 列表/卡片/网格？槽位、密度、截断、点击区、行级动作？ | controlRefs / rowBudget / unit / rowForm / slots / density / truncation | 页面、行预算 resolver、控件契约 |
| 结构 | 7 查询筛选 | 搜索/筛选/排序放哪？何时生效？结果为空怎么办？ | placement / applyTiming / resultState / reset / controlRefs | ReaderSearchField、ReaderSelectPanel |
| 结构 | 8 页脚 | 是否有 dock？主操作是什么？与页头是否重复？安全区？ | actionRefs / controlRefs / presence / actions / safeArea / dedupe | ReaderPageScaffold footer slot |
| 结构 | 9 覆盖层 | sheet/dialog/popover/menu/toast/recovery？层级、遮罩、关闭、所有权、消息入口？ | types / host / zOrder / dismiss / messageRefs / platformHostRefs | ReaderSheetChrome、ReaderDialogSurface、ReaderSelectPanel、ReaderTransientFeedback + ReaderTransientToast、ReaderRecoveryNotice |
| 结构 | 10 状态 | 加载/刷新/分页/空/筛选空/错误/部分/离线/未知回执？旧内容是否保留？走哪个消息通道？ | matrix / transitions / debounce / messageChannels / operationRefs / oldContentPolicy | ReaderPageState、ReaderRecoveryNotice、ReaderRecoveryAction |
| 表达 | 11 视觉 | 字阶、对比度、表面、圆角、阴影、图标 | type / color / surface / radius / icon | ReaderTypography、ReaderThemeRegistry、ReaderSurfaceSpecs |
| 表达 | 12 交互 | 触控目标、按下/选中/忙碌/禁用、反馈、手势、焦点 | controlRefs / states / target / feedback / gesture / focus | ReaderButton、ReaderToggle、ReaderPressFeedback |
| 表达 | 13 适配 | 宽度断点、字体缩放、方向、主题、键盘、减弱动效 | width / fontScale / orientation / theme / keyboard / motion | ReaderPageGeometry、ReaderHeaderSpecs、ReaderLayoutGeometry |
| 表达 | 14 可访问 | 角色、名称、状态、焦点顺序、非颜色编码、对比度、字号上限 | a11yRuleRefs / role / name / state / order / nonColor / contrast / touchTargets / focus | 页面与组件、无障碍契约 |
| 契约 | 15 测量 | 谁测、测量键、revision、缓存、几何输入、组件边界 | keys / revision / cache / geometry | ReaderPageScaffold、ReaderMeasurementStore |
| 契约 | 16 数据 | 身份、世代、串行化、回执、陈旧回调、投影一致性 | operationRefs / projectionSource / identity / generation / serialization / stale / refreshPolicy | Host、Orchestrator、Projection |

### 3.2 七个产物

| 产物 | 作用 | 事实源 |
|---|---|---|
| Ontology | 16 层定义与边界 | 本文档第 3 节 |
| Grammar | 原型、合法组合、非法组合 | 本文档第 4 节；`tools/page-structure/model.json` |
| Decisions | 从 PageBrief 推导结构 | 本文档第 6 节；`model.json` |
| Invariants | MUST/SHOULD/MAY、等级、检查方式 | 本文档第 7 节；`model.json` |
| Register | 每页 16 层实例 | `tools/page-structure/register.json` |
| Exceptions | 例外账本 | `tools/page-structure/exceptions.json` |
| Checks | 合规检查 | `tools/page-structure/check-register.mjs`、`check-contract-refs.mjs` |

JSON 模型与登记已落地，分别作为机器规则和实例事实源；本文档解释规则。变更时模型/schema/登记与文档必须同步，不在两处维护相互冲突的定义。

消息入口清单 `tools/message-entrypoints.json` 是外部依赖产物，不并入这七个产物；Register 只引用其入口 ID，消息分类和生命周期仍由消息框架维护。

契约地图和上游登记（`tools/contracts/*`）同样是外部依赖，不并入七个产物。七个产物只描述页面结构自身；路由、控件、无障碍、操作和平台宿主通过 `register.json` 的引用字段进入，不能把上游登记复制成页面结构的第二套事实源。

### 3.3 合规层级

| 层级 | 检查内容 | 方式 |
|---|---|---|
| L0 | 登记完整：16 层无空项，Brief/Choice/规则引用齐全 | 自动 |
| L1 | 语法与结构：原型、非法组合、inset、重复动作 | 自动 + 源码断言 |
| L2 | 行为：状态矩阵、返回消费、忙碌/禁用、陈旧回调 | 定向测试 |
| L3 | 视觉与可访问：366×844 demo、设备对比、读屏、对比度、字体缩放 | 人工 + 设备 |
| L4 | 用户验收 | 用户 |

结果只能是 `PASS / FAIL / EXCEPTION / NOT_RUN`。没有执行就是 `NOT_RUN`，不能写成 `PASS`。

## 4. 页面原型与语法

### 4.1 原型选择

| 原型 | 适用条件 | v0.2 深度 |
|---|---|---|
| RootTabPage | 根标签页，底部导航常驻，主页头，单滚动，区块流 | 详细 |
| SecondaryCollectionPage | 二级集合页，返回头，单滚动，查询/筛选，可选页脚 | 详细 |
| SecondaryDetailPage | 二级详情页，返回头，单滚动，详情正文 | 语法定稿 |
| CompoundSearchPage | 复合搜索页，返回头 + 主查询，结果集合，筛选浮层 | 语法定稿 |
| SelectionPage | 选择页；直接单选用返回头与行级提交，批量选择用上下文头与底部提交 | 语法定稿 |
| ReaderPage | 阅读器，无标准页头，页面画布，瞬时 chrome | 详细 |

选择规则按以下优先级执行，首次命中后结束；特殊任务先于普通集合页：

1. `purpose=read` → `ReaderPage`。
2. `role=root` → `RootTabPage`；该原型要求根标签导航。
3. `purpose=select` → `SelectionPage`。
4. `purpose=search` → `CompoundSearchPage`。
5. `purpose=inspect` → `SecondaryDetailPage`。
6. 其余非根、非阅读的 `content=collection` → `SecondaryCollectionPage`。

以上顺序与 `model.json.prototypes` 完全一致。`queryPriority=primary` 本身不表示搜索页：章节目录可以以浏览为任务、以查询为主要导航手段，因此仍是 `SecondaryCollectionPage`。推导前拒绝矛盾输入：`purpose=read` 与 `navigationPersistence=required` 不能共存；`purpose=select` 必须声明 `selectionMode!=none`。缺少任务意图、字段冲突或没有命中时返回带规则的错误，不能默认套成集合页。

无法归入以上原型时，先停止并补充原型，不要用“看起来像”的页面套用。

机器模型的每个原型同时声明 `headerRole`、`headerPresentations` 和 `queryPlacements`。决策函数推导后必须再次检查原型语法；例如复合搜索页不得得到Floating页头、详情页不得得到ScrollAway，矛盾输入返回GRAMMAR错误并要求解决Brief，不静默改结构。原型选择收敛与组合合法性分别检查。

### 4.2 语法

```text
RootTabPage
  = RootScaffold
  + HomeHeader
  + PersistentTabBar
  + SinglePrimaryScroll
  + SectionFeed
  + OptionalGlobalAction
  + OverlayHost

SecondaryCollectionPage
  = SecondaryScaffold
  + Header(role=Back, presentation=Fixed|Floating|ScrollAway|None)
  + SinglePrimaryScroll
  + Query(placement=Inline|HeaderSlot|Overlay|None)
  + Collection(unit=Row|Card|Grid)
  + StateMatrix(collection)
  + PrimaryAction(placement=Footer|Header|Row|None)
  + OverlayHost(transient)

SecondaryDetailPage
  = SecondaryScaffold
  + Header(role=Back, presentation=Fixed|Floating)
  + SinglePrimaryScroll
  + DetailBody
  + OptionalFooterAction
  + OverlayHost

CompoundSearchPage
  = SecondaryScaffold
  + Header(role=Back, presentation=Fixed)
  + Query(placement=HeaderSlot, priority=primary)
  + ResultCollection
  + Filter(placement=Overlay)
  + StateMatrix(result)
  + OverlayHost

SelectionPage(selectionMode=single, primaryActionScope=perItem)
  = SecondaryScaffold
  + Header(role=Back, presentation=Fixed)
  + SinglePrimaryScroll
  + SelectableCollection(commit=perItem)
  + OptionalFooter
  + OverlayHost

SelectionPage(selectionMode=multi, primaryActionScope=global)
  = SecondaryScaffold
  + Header(role=Contextual, presentation=Fixed)
  + SinglePrimaryScroll
  + SelectableCollection
  + FooterAction(selection)
  + OverlayHost

ReaderPage
  = ReaderScaffold
  + NoStandardHeader
  + PageCanvas
  + TransientChrome
  + OverlayHost(modal)
  + Geometry(safeArea)
```

直接单选是同一SelectionPage的`direct-single`组合变体，不新增第七个原型。例如漫画换源目录点行即返回阅读，不要求再画一个确认页脚；该差异由`selectionMode`与`primaryActionScope`共同推导。多选必须有全局提交，仍保留Contextual头和必需Footer；不能用直接单选变体掩盖批量任务缺失提交区。

### 4.3 非法组合

以下组合不得出现在登记为 `PASS` 的页面中：

| ID | 非法组合 | 原因 |
|---|---|---|
| G-01 | HeaderSlot 查询 + Inline 查询同时存在 | 同一查询两个入口，主次不明 |
| G-02 | 固定页脚 + 页头同一语义动作，无主次差异 | 同一业务动作重复实现 |
| G-03 | 浮动/underlap 页头未声明遮挡补偿 | 首行可能被页头遮住 |
| G-04 | 固定页脚未提供 contentEndInset | 末行/状态页可能被页脚遮住 |
| G-05 | 浮层宿主未先消费返回 | 返回直接退页，浮层残留或状态错乱 |
| G-06 | 行内动作总宽超预算，却不切换行形态 | 文字列被压缩或裁切 |
| G-07 | 可筛选集合没有 filteredEmpty | 筛选无结果时页面空白 |
| G-08 | 非选择页使用上下文页头 | 页头语义与页面任务不符 |
| G-09 | 同一页面存在两个主滚动 owner，且未声明手势优先级 | 滚动手势冲突 |
| G-10 | 固定页头/页脚未参与测量或 revision | inset 使用过期高度 |
| G-11 | 从离开时的瞬时 route 推断父级或回程 | 返回目标漂移，子旅程覆盖原父级 |
| G-12 | 平台宿主登记为应用路由，或页面为平台表面重复绘制外框 | 返回栈多一层；双重材质 |
| G-13 | 平台宿主缺少发起 identity 或 returnContext | 旧 session/旧页面的结果落到新实体 |
| G-14 | 页面写动作未绑定 `operationId` 和 owner | busy/unknown/refresh 语义无法判定 |
| G-15 | 已确认写后的刷新失败被当作重发写的理由 | 重复写入、删除或导入 |
| G-16 | 控件未登记状态集（busy/disabled/selected/error）或命中区 | 可重复提交、只靠颜色、触控不达标 |

非法组合由 L1/L2 检查；不能自动检查的，登记为人工检查项，不得默认 `PASS`。

## 5. PageBrief

### 5.1 输入结构

```ts
interface PageBrief {
  pageId: string;
  purpose: 'browse' | 'search' | 'select' | 'read' | 'inspect' | 'form';
  role: 'root' | 'secondary' | 'detail' | 'modal' | 'reader';
  content: 'collection' | 'document' | 'form' | 'canvas';
  queryPriority: 'none' | 'secondary' | 'primary' | 'complex';
  navigationPersistence: 'required' | 'optional' | 'none';
  contentImmersive: boolean;
  titleCanExit: boolean;
  alternateNavigation: boolean;
  queryComplexity: 'simple' | 'complex';
  queryFrequency: 'frequent' | 'rare';
  collectionLength: 'short' | 'long';
  primaryActionScope: 'none' | 'global' | 'perItem' | 'navigation';
  selectionMode: 'none' | 'single' | 'multi';
  stateSet: string[];
  messageSet: ('transient' | 'recovery' | 'pageState' | 'confirm' | 'task')[];
  platformSet: ('filePicker' | 'loginWeb' | 'nativeAlert' | 'share' | 'mediaSession' | 'externalOpen' | 'permission' | 'backgroundTask')[];
  widthClass: 'compact' | 'regular' | 'expanded';
  fontScale: number;
  queryViewport?: { availableHeight: number; fixedChromeHeight: number; minimumContentHeight: number };
}
```

字段语义：

| 字段 | 说明 |
|---|---|
| `role` | 页面在导航栈中的角色，不是视觉风格 |
| `purpose` | 页面存在的主要任务；区分浏览集合、查询产物、选择、阅读、详情和表单 |
| `content` | 页面主体是集合、文档、表单还是画布 |
| `queryPriority` | 查询是主任务、次任务、复杂多条件，还是不存在 |
| `navigationPersistence` | 页面是否要求页头/导航持续可达 |
| `contentImmersive` | 内容是否要求沉浸、页头是否应弱化 |
| `titleCanExit` | 标题是否允许随滚动退场 |
| `alternateNavigation` | 页头不可见时是否有已声明的替代导航；不是“以后可以补” |
| `queryComplexity` / `queryFrequency` | 查询条件复杂度与实际使用频率；为查询位置决策提供显式输入 |
| `collectionLength` | 预期集合长短；登记业务依据，不能用当前偶然条数改变页面类型 |
| `primaryActionScope` | 主操作作用于集合、单行、导航还是不存在 |
| `selectionMode` | 是否有选择态，单选还是多选 |
| `stateSet` | 该页必须支持的状态集合 |
| `messageSet` | 该页需要承载的消息类别；`pageState` 必须与 `stateSet` 中的加载/空/错误/筛选空对齐，其余类别按消息框架分类 |
| `platformSet` | 该页实际发起并接收结果的平台宿主；只列真实入口，不列“以后可能用”的宿主；JSON 导入等应用自绘表面不计入 |
| `widthClass` | 当前只有 `compact` 用于 366×844；其他值在基线验收后启用 |
| `fontScale` | 当前验收点 1.0 / 1.3 / 1.6 / 2.0 |
| `queryViewport` | primary查询的可选实际高度预算；取当前owner候选固定装配的未clamp需求与有效内容最小单元，不取降级后的0；见6.2 |

### 5.2 Brief 规则

- Brief 只写业务事实，不写“我想要浮动”“我想要圆角”这类视觉偏好。
- 无法确定的字段必须标记 `UNRESOLVED`，不得用默认值掩盖。
- 同一页面变更 Brief 后，必须重新推导并 diff，不能只改登记结果。
- Brief 是页面登记的一部分，不能只存在于对话或 issue 中。
- `messageSet` 不是 UI 偏好；每个值必须有对应业务事实和已登记消息入口，不能为“可能有提示”预先加入。
- `pageState` 出现在 `messageSet` 时，`stateSet` 必须包含对应状态；两处不一致时 Brief 无效。
- `platformSet` 必须与 `platformHosts` 的实际条目一致；缺一项或多一项都是 `FAIL`。平台宿主不是页面路由，不因 `platformSet` 增加路由。
- 书源页的 `platformSet` 当前只有 `loginWeb`；`JsonImportDialog` 是应用自绘对话框，不进入 `platformSet`。

### 5.3 RouteContract（层 1 独立输入）

`PageBrief` 描述页面结构意图，`RouteContract` 描述路由与回程事实。两者共同作为层 1 的输入；`RouteContract` 不塞进 `PageBrief`，避免把导航状态机伪装成页面偏好。

```ts
interface RouteContract {
  routeId: string;
  route: string;
  owner: string;
  sources: { path: string; symbol?: string }[];
  parentRoutes: string[];
  entrySources: string[];
  backPolicy: (
    | 'platform'             // 根页面，未消费的 Back 交平台
    | 'captured-parent'      // 回到进入时捕获的父级
    | 'overlay-first'        // 先关当前页的临时层
    | 'blocked-when-busy'    // 写入/批量操作中消费 Back 并留页
    | 'platform-host'  // 平台宿主参与 Back，应用不假设顺序
  )[];
  retention: {
    view: boolean | null;
    query: boolean | null;
    scroll: boolean | null;
    selection: boolean | null;
    draft: 'keep' | 'discard' | 'ask' | 'unknown';
    basis: 'observed' | 'target' | 'mixed';
  };
  systemBackOwner: string;
  restorePolicy: 'fresh' | 'resume' | 'reload' | 'reconcile';
  platformHostRefs: string[];
  visibility: 'visible' | 'retained';
  status: 'resolved' | 'unresolved';
  unresolvedRefs: string[];
  evidenceBoundary: string;
  knownGap?: string;
}
```

规则：

1. 每个页面必须有 `RouteContract`；二级页不得缺非空 `parentRoutes` 或 `captured-parent`；根页的 `parentRoutes` 为空数组。
2. `parentRoutes` 是合法父级集合，实际父级在进入时捕获；离开时不得按瞬时 route 重算。
3. `backPolicy` 是集合，不是单一枚举：例如书源页同时需要 `overlay-first`（先关分组下拉）和 `captured-parent`（回设置/搜索）。
4. `retention` 必须显式：普通返回默认保留 view/query/scroll；只有明确新搜索、刷新、冷进入或成员身份变化才重置。草稿不能默认丢弃。
5. `systemBackOwner` 必须指向真实 owner；平台窗口可能先于页面消费 Back，实际顺序未验证时 `platform-host` 只表示“应用不假设”，不表示平台一定先行。
6. `restorePolicy` 区分 `fresh`（重建）、`resume`（恢复旧投影）、`reload`（重新读取）、`reconcile`（核对原写/回执）；不能把普通返回一律写成 `reload`。
7. `platformHostRefs` 只引用宿主登记；宿主内部生命周期、权限和关闭顺序不在路由契约中复写。`platformHostRefs` 非空时，`backPolicy` 必须包含 `platform-host`。
8. 任一保留规则或 Back 顺序尚未冻结时，`status: 'unresolved'` 并填写非空 `unresolvedRefs`（如 `NAV-07`、`NAV-08`）与 `knownGap`；该页层 1 不能记 `PASS`，但不阻止其他层继续登记。`retention.basis` 区分实见、目标与混合策略，`null` 只表达尚未冻结，不能当作已保留。

## 6. 决策函数

### 6.1 页头呈现

| 条件 | 结果 | 优先级 |
|---|---|---|
| `purpose=read` | None（标准页头） | 1 |
| `navigationPersistence=required` | Fixed | 2 |
| `navigationPersistence=optional` 且 `titleCanExit=true` | ScrollAway（普通列表与沉浸内容均可） | 3 |
| `navigationPersistence=optional` 且 `contentImmersive=true`、`titleCanExit=false` | Floating | 4 |
| `navigationPersistence=none` 且 `alternateNavigation=true` | None | 5 |
| 其他有效输入 | Fixed | 6 |

按优先级首次命中；阅读器 Brief 不得要求标准导航常驻，矛盾输入记 `UNRESOLVED`。`None` 没有替代导航时不可生成。“导航可选、标题可离场”允许普通集合页使用ScrollAway；标题不可离场且非沉浸时仍由兜底推导Fixed，不要求普通列表谎报沉浸内容。

约束：

- Floating 必须声明遮挡补偿和 contentGap。
- ScrollAway 必须有明确的标题退场与回归条件。
- None 必须有替代返回机制；二级页不得无返回。

### 6.2 查询位置

| 条件 | 结果 | 优先级 |
|---|---|---|
| `queryPriority=none` | None | 1 |
| `queryPriority=primary` 且真实 `queryViewport.fixedChromeHeight + minimumContentHeight > availableHeight` | Inline，默认同一主列表内的 ScrollAway 前缀。持续编辑的嵌入模块可以使用下述限高编辑区 | 2 |
| `queryPriority=primary` 且预算足够或未声明响应预算 | HeaderSlot | 3 |
| `queryComplexity=complex` 且 `queryFrequency=rare` | Overlay | 4 |
| `queryPriority=complex` | Overlay | 5 |
| `queryPriority=secondary`（含短集合） | Inline | 6 |

规则优先级与 `model.json.decisions.query.rules` 一致；合法枚举以外或无规则命中时返回 `UNRESOLVED` 错误。

`collectionLength` 用于首屏预算校准；不允许因为集合暂时较短而没有合法查询位置。

`queryViewport`是可选的真实几何输入，包含有限数值`availableHeight>0`、`fixedChromeHeight>=0`、`minimumContentHeight>0`；fixedChromeHeight指候选固定装配在当前字号下所需的未clamp高度，不是降级后实扣的0。不能用`Math.max(0,listHeight)`掩盖欠账，也不能把降级后的0再送回选择器导致反复切换。它只适用于primary查询，推导器内部计算`queryHeightClass`，页面作者不得手填constrained布尔或降低查询优先级。缺输入不推定矮屏；availableHeight为0代表尚未就绪，不能伪造可用结构。原型不允许Inline时仍返回GRAMMAR错误。

ScrollAway变体必须登记准确生效条件、测量/字号revision、唯一滚动owner、prefix与Core/data rank映射、锚点和焦点迁移。prefix不是第0章；分页/选择/下载仍用业务索引。空、加载、筛选空和错误时查询仍可达。嵌入模块只豁免整页原型外框，不豁免显式queryViewport的决策核对；`check-register`单独检查这一层。

阅读内目录这类持续编辑的嵌入模块，在实际预算触发 Inline 时可以登记 `inlineComposition=boundedEditor`。查询在各高度下保持同一个原生编辑宿主。局部编辑 Scroll 与唯一主结果 List 各使用内容槽内不重叠的高度，编辑区可单独滚达查询，结果 List 保持自己的数据索引、滚动锚点和当前状态。登记提供实际首屏的内容槽及编辑区高度，并验证高度变化不重建同一输入及结果实例。没有可用结果空间时按模块的空间不足状态处理；可用状态需要实际可达的结果任务或状态回馈。此装配仍按 Inline 计入首屏预算及焦点验收。

约束：

- HeaderSlot 与 Inline 不得同时存在同一查询。
- Overlay 查询必须有持久触发入口，不能只在空态出现。
- Inline 查询必须计入首屏预算；正常预算须保留首个任务单元。固定区本身无法和任务单元共存时，可以让同一主列表的prefix先占首屏，滚动即可完整访问查询和内容；不得新增外层主滚动、重复扣固定inset，或把被固定区裁掉的列表当可用。

### 6.3 主操作位置

| 条件 | 结果 | 优先级 |
|---|---|---|
| 动作作用于单行 | Row / Overflow | 1 |
| 动作作用于整个集合 | Footer | 2 |
| 动作属于导航级 | Header | 3 |
| 无主操作 | None | 4 |

约束：

- 同一语义 owner 不得同时占页头与页脚，除非有明确主次和上下文差异。
- Footer 存在时必须提供 contentEndInset，并保证状态页与末行可见。
- 主操作位置与固定方式分别声明：Footer可以是列表尾部内容，也可以是当前任务的固定操作区。普通浏览常态List、管理态固定Footer时，标题仍可随同一List滚动；只有固定Footer才额外预留其真实预算与安全区，inflow尾项不重复扣除。固定区使内容低于当前有效任务单元的最低预算时，须明确可访问降级；退出管理的动作在管理态保持可达。
- 行内动作过多时，优先切换行形态或溢出菜单，不压缩文字列。

### 6.4 浮层选型

先按业务事实确定消息类别（消息框架），再按页面结构确定宿主、层级和避让；不得用“这里想放个浮层”反推消息类别。

| 条件 | 结果 |
|---|---|
| 阻断式确认、不可继续 | Dialog |
| 复杂多选、批量、需要展开 | Sheet |
| 锚定单选、轻量 | Anchored Panel |
| 瞬时反馈、不阻断 | Toast |
| 未决操作、回执不明、需要核对 | Recovery Notice |
| 简单动作列表 | Menu |

约束：

- 只能使用已登记的宿主；不得页面自建同类外框。
- `messageSet` 中没有的类别不建空宿主；新增消息类别先改 Brief 和消息入口，再改页面结构。
- 每个消息表面必须引用 `tools/message-entrypoints.json` 的入口 ID；未登记入口不得上线。
- 有旧内容时的普通刷新/读回失败走 Toast，不替换内容区；首次加载、确认空、无可用内容失败才走 PageState。
- 未决原操作、回执不明走 Recovery；关闭提示不等于业务 ACK。
- 持续任务、真实进度、逐项结果走登记的专用任务组件，不因“需要展开”而改写成普通 Sheet 或 Toast。
- Toast 不承载恢复；Recovery 不承载普通成功提示。
- Dialog 不用于非阻断选择。
- 消息跟随当前有效宿主，不设全局“永远最上层”的消息层；同一宿主去重和旧宿主退休按消息框架执行。
- 浮层必须先消费返回，再允许路由退页。

#### 6.4.1 全应用覆盖层装配

覆盖层遵循同一份底页几何不变契约。相同viewport、系统字号和安全区下，打开、关闭、展开长文或更新busy，只更新覆盖表面及其输入资格。底页的页头实测、内容起点、可用高度、列表extent、滚动锚点、路由和控制栏展开预算保持。原业务动作产生的导航与数据更新继续由原owner发布。

`ReaderPageScaffold` 已提供内容0、页头10、页脚20和覆盖30四个同作用域层。普通页面使用其 `overlayContent`，原生Dialog、bindSheet、bindPopup和bindContentCover使用各自已登记的分离宿主。页面登记分别说明实际phone、expanded及入口变体的挂载链。zIndex在当前窗口和父Stack作用域内解释，平台窗口层级由平台宿主负责。

覆盖表面的测量用于自身限高、锚点和同层避让。页头与正文测量仅消费页面固定区域的事实。Recovery、Dialog和Sheet的内容、代次与busy字段保持在覆盖链内。书架两个浮层互相避让的测量属于覆盖层布局，须单独注明实际消费目标。

标准页的有界覆盖表面使用 `ReaderStandardPage.boundedOverlayVisible` 和无参 `boundedOverlayContent`。StandardPage直接持有真实视口、当前页头与页脚几何、覆盖区宽度、位置、限高和输入边界。调用页仅发布当前可见资格与内容。SettingsShell和MainTabShell的standardScroll分支转交这两个字段。旧单参数overlayContent继续保留兼容转发，当前恢复表面的几何在实际持有者内读取。声明式Builder传递可变几何时须验证同一原生actor能随真实属性更新，首次参数值无法更新即为失败。

#### 6.4.2 前景与输入归属

用户主动打开的控制栏、选择面板、菜单、Sheet及平台前景拥有当前交互优先级。被动Recovery在这些前景占用期间暂退绘制、输入和无障碍遍历，原事项、回执和写准入仍归原业务owner。返回原可呈现宿主后按当前身份恢复。独立目录属于当前控制前景，详情来源的退出仍遵循原详情返回路径。

Modal确认和Sheet独占其声明的输入范围，关闭后恢复原触发源焦点。非模态可交互表面在自身实际边界内独占同级命中，并按宿主要求处理祖先事件，区域外输入继续交原页面。Toast只呈现反馈。隐藏、暂退和已卸载的表面同步退出命中及无障碍遍历，已排队动作再次核对原宿主、实体和展示代次。

布局验收同时核对控件与内容可达性。目录的拖拽柄、收起、查询、首章、末章、书签及页脚动作都有当前有效入口。窄窗与大字号下优先调整覆盖表面自身的有界滚动和前景协调。关闭提示只处理投影，原操作的核对、继续和取消资格继续沿原owner执行。

#### 6.4.3 可执行边界与证据

手动装配检查使用实际SDK AST追踪Scaffold、StandardPage和三个既有Shell的具名Builder槽，包括nativeListItems、Settings的homeContent/generalContent及boundedOverlayContent。通过本地与导入Builder、参数转交和集合Builder追踪到实际表面，原生分离宿主作为独立作用域。已知骨架中实际声明并提供的BuilderParam缺少装配角色时记录UNRESOLVED。正常PageState和覆盖表面内部测量保留原角色。

受控清单为 `tools/page-structure/overlay-assembly-contracts.json`。已确认的几何消费链声明实际目标方法、覆盖事实和失效入口，检查按真实callee读链核对。动态目标解析失败、来源漂移或无法证明的装配保留对应诊断。该工具按任务手动选择，无参为NOT_RUN，默认关闭，未接入构建或CI。

```sh
node tools/check-overlay-assembly.mjs --check --inventory-file tools/page-structure/overlay-assembly-contracts.json
```

当前快照的字节一致、构造数量与单独叶节点属性分别记录。覆盖行为验收连接实际外层Watch、HeaderHost、Scaffold几何和原生动作actor，比较关闭、显示、busy、长文、已退场与后继展示。额外保留正常viewport或字号变化会更新页面几何的正例。Native视觉、触摸、平台返回和读屏继续绑定实际候选与目标。

### 6.5 行形态

```text
预算内              → single-line
预算不足            → two-line
仍不足              → overflow-menu
行内动作即主操作    → detail-entry
```

禁止：缩小字号、裁掉状态、横向滚动、隐藏主操作来通过预算。

### 6.6 状态矩阵推导

状态集合由 Brief 和操作能力共同决定；展示通道由消息框架按业务事实决定，页面结构只决定放在哪个 slot/层。

| 条件 | 必需状态 |
|---|---|
| 首次读取 | loading |
| 空集合 | empty |
| 可筛选 | filteredEmpty |
| 可重试读取且无可用旧内容 | error + retry |
| 可重试读取但有可用旧内容 | transient error（Toast），保留内容 |
| 可写操作 | busy / disabled |
| 有未决回执 | unknownReceipt |
| 有原操作阻断 | blocked |
| 离线可用性受限 | offline |
| 分页/增量 | loadingMore / endReached |

缺一不可；状态之间必须有明确转换条件。

| 状态/事实 | 展示通道 | 事实 owner | 禁止 |
|---|---|---|---|
| 首次加载 | PageState loading（内容区） | 页面投影 | 用 Toast 代替首次加载 |
| 确认空、无可用内容失败 | PageState empty / error | 页面投影 | 旧内容可用时整页替换 |
| 筛选空 | PageState filteredEmpty | 筛选投影 | 与原始 empty 混用 |
| 普通刷新/读回失败，旧内容可用 | Toast | 原 operation 投影 | 阻断内容、伪造重试成功 |
| 未决原操作、回执不明 | Recovery | 原业务 owner | 关闭提示即视为 ACK |
| 持续任务、逐项结果 | 登记的专用任务组件 | 原任务 owner | 降级为 Toast/普通 Sheet；关闭即取消任务 |
| 可写操作 busy/disabled | 行内动作状态 | 原操作事实 | 从 `canRetry=false` 推导 busy |
| 确认/危险操作 | Dialog / 原生确认 | 原宿主 | 非阻断选择用 Dialog |

### 6.7 收敛示例

| 页面 | Brief 差异 | 推导结果 | 判定 |
|---|---|---|---|
| 书源管理 | 二级、集合、查询次级、导航常驻、全局动作 | Fixed + Inline + Footer | 当前骨架正确，不需要结构重写 |
| 书籍目录 | 二级、集合、查询为主、导航常驻 | Fixed + HeaderSlot + None | 与书源页的差异是合法变体 |
| 下载管理 | 二级、集合、查询次级、导航可选、标题可离场 | ScrollAway + Inline + Footer | 用户已选常态列表；管理态Footer按任务与最低内容预算固定/降级，头尾位置分别登记，未由此宣称原生合规 |

收敛测试：同一 Brief 与同版模型/RouteContract 上下文推导出的原型、页头、查询和主操作位置必须一致。`derive-structure` 只推导结构选择，不生成实际测量值、组件绑定、状态实现和证据；16 层实际事实必须分别登记，不能把纯函数输出当作实现已通过。

### 6.8 路由、返回与平台宿主

层 1 不按页面外观推导，按 `RouteContract` 和实际入口推导。

| 条件 | 结果 |
|---|---|
| 根标签页 | `parentRoutes=[]`；未消费的 Back 交平台 |
| 二级页面 | `captured-parent`；父级在进入时捕获 |
| 页面有分组下拉、筛选面板、动作 Sheet 等临时层 | `overlay-first`，先关临时层再退路由 |
| 批量删除、导入、登录等写入进行中 | `blocked-when-busy`，消费 Back 并留页 |
| 页面动作交给平台宿主 | `platform-host` + `platformHostRefs`；不新增应用路由 |
| 阅读器 | `systemBackOwner` 是 reader controller；普通 Back 与明确导航退出分开 |
| 来自设置/搜索的书源页 | 捕获设置或搜索父级；不从离开时的 route 猜测 |

保留策略必须逐项声明。下表是目标策略，不是当前实现现状；页面未实现时登记差异，不能把表当成已通过证据：

| 事件 | view | query | scroll | selection | draft |
|---|---|---|---|---|---|
| 普通返回 | 保留 | 保留 | 保留 | 清除 | 保留或询问 |
| 明确新搜索/刷新 | 按结果重建 | 重置 | 重置 | 清除 | 保留 |
| 冷进入/成员身份变化 | 重建 | 重置 | 重置 | 清除 | 不适用 |
| 平台宿主取消 | 保留 | 保留 | 保留 | 保留 | 保留 |
| 平台宿主成功 | 保留页面 | 保留 | 保留 | 按结果处理 | 保留到核对完成 |
| 确认换源改变成员 | 丢弃旧成员快照 | 保留 | 保留 | 清除 | 不适用 |

规则：

- 普通返回和明确导航退出是两种路径；不能用一个 `backTarget` 覆盖。
- 平台宿主不是路由；`platformHostRefs` 只建立关联，不进入返回栈。
- 平台宿主结果必须核对发起时的 identity；旧 session、旧页面、旧世代的回调丢弃。
- 宿主 Back 顺序默认 `unknown`；没有平台证据时不能写“平台一定先”或“应用一定先”。
- 源页当前只登记 `loginWeb`；JSON 导入不进入平台宿主表。
- 小说详情的书籍信息、原文件和正文选文使用 Share Kit 系统面板。详情按当次书籍和输入准入捕获回程，选文按当前 ReaderShell 正文、段落或片段代次捕获原文。对应 `platform.detailShare` 和 `platform.readingSelectionShare` 登记了真实入口及平台结果。系统 Back、焦点恢复、面板几何与接收端读文件仍待原生证据。[平台宿主登记](../../tools/contracts/platform-host-registry.json) · [分享与复制控件登记](../../tools/contracts/control-registry.json)

### 6.9 控件状态

控件状态由业务操作事实推导，不由页面文案或按钮外观猜测。

| 控件类型 | 必需状态 | 命中/可访问 | 禁止 |
|---|---|---|---|
| 主按钮 | default / pressed / disabled / busy / error | ≥44vp 或等效 response region；有名称 | 用灰色文字代替 disabled 语义 |
| 图标按钮 | default / pressed / disabled / busy | ≥44vp 命中；有可访问名称 | 只有图标没有名称 |
| 开关 | on / off / pressed / disabled / busy | 有名称和状态播报 | 只用颜色表示开关 |
| 输入框 | default / focus / filled / error / disabled / readOnly | 有 label、键盘类型、错误说明 | 用 placeholder 代替 label |
| 选择/chip | default / pressed / selected / disabled | 选中态有文字/图标，不只靠颜色 | 用填色变化冒充状态 |
| 行级动作 | default / pressed / busy / disabled | 不与整行点击冲突 | 行点击和动作点击同一语义 |
| 标签页 | default / selected / pressed / disabled | 有 role/state；焦点顺序稳定 | 选中态只靠颜色 |
| 正文无障碍动作 | ready / disabled / hidden | 分页的上一页、打开阅读控制栏、下一页依次对应正文的左、中、右三等分；连续阅读提供中心控制栏入口；稳定 ID 在[控件登记](../../tools/contracts/control-registry.json) | 额外接管物理触摸或在被覆盖时派发动作 |

规则：

- `busy`、`disabled`、`error` 必须来自 `OperationFacts` 或原 owner；不能从 `canRetry=false`、文案前缀或局部布尔推断。
- 每个交互控件必须有 `controlId`，并解析到 [ReaderControlSpecs.ets](../../entry/src/main/ets/ui/controls/ReaderControlSpecs.ets) 或已登记控件；页面不得自建同语义控件。
- 点击区不足 44vp 时必须有等效 response region；该例外必须有 owner 和到期条件。
- 选中、危险、错误、禁用状态不得只靠颜色；必须有文字、图标或可访问状态。
- 忙时重复点击不得触发第二次回调；禁用必须给出可理解的原因。
- 事实变化后，保留同一控件实例，确认实际 SDK 生成的 child updater 从当前 owner 读取值，并经真实子组件 `updateStateVars` 同步视觉和语义状态。子组件字段已有 `@Prop`，不能证明父级 `@Builder` 闭包传入的 primitive 不是首次快照；不得用重建控件或重新运行整个 Builder 代替原实例更新验证。分别新建两份 selected 快照也不能证明这一链路成立。
- 等效命中区必须由实际 carrier 和父级布局支付。自然高度 16vp 的 Text 声明 `y: 0, height: 44`，不等于该行已经获得 44vp 点击空间；须核对叶节点 bounds、response 的坐标基准、父级预算、clip、相邻目标及安全区。小 paint 可以居中于已付款的 44vp carrier，不能靠允许越父命中或放松 clip 掩盖缺口。
- 紧凑文字动作的轮廓根据实际文字自然宽度、行高和内边距增长，规格宽高作为下限。背景、描边和圆角由内层绘制宿主承担，外层保留完整命中框。父行必须为增长后的动作与标题同时分配宽度，并声明长文案采用换行、增高或重新装配的边界。修改文案时验证真实字形及剩余标题空间。
- pill规格的语义值由实际绘制宿主解析。固定或已知绘制盒使用有限圆角，最大为绘制盒短边的一半。自然尺寸的原生胶囊按钮使用受支持的Capsule形态。非按钮自然表面从当前绘制节点的有效尺寸取得半径，测量仍遵守当前展示、宽度、字号与退场身份。响应区或外部44vp载体的尺寸各自保留，不能替代内部绘制盒。选中、按下、禁用和同一节点的规格变化共同验证，直接把999交给原生borderRadius不能证明胶囊几何成立。
- 自然表面区分已采用几何和新回执准入。窗口、配置或内容修订会拒绝旧闭包回执，同一原生节点已采用的有效尺寸可继续用于绘制，等待当前Area更新。尺寸未改变时平台可能不再触发Area，修订本身不能让已采用圆角长期退回首次布局值。重新展示时清理前一展示的测量，首次布局回落和实际原生材质各自记录。
- 圆角表面的父级裁剪须声明具体职责，例如滚动视口、图片裁切、展开揭示或动画遮罩。取消父级裁剪前，以当前有效测量和真实子树证明文字、图标、背景及响应载体均包含于材料边界，未测量、陈旧、窄宽或超预算输入保留安全回落。分别核对背景描边和子树裁剪的实际原生结果。装饰性空绘制节点避免增加多余子树裁剪，内部百分比轨道和实际滚动视口继续持有各自遮罩。
- 系统字号变化须到达实际持有原生尺寸属性的观察节点。跨View的geometry重算、key更新及Watch调用分别核对实际传递链，同一已挂载控件经真实属性刷新后应取得新尺寸。沿用静态metrics getter时，须在该观察路径消费既有响应式revision。
- 原生命中证据须从当前目标树取得唯一目标和坐标，结合实际 response 声明，在可见且已付款的边缘验证当前实体只收到一次正确回调。paint 外点击与普通中心点击分别记录；某个模板通过不代表整页 E2 通过，未派发的点击不能记命中失败或成功。

### 6.10 无障碍

无障碍不是 L3 的“最后看一眼”，而是层 14 的登记事实。

| 范围 | 必须登记 | 检查 |
|---|---|---|
| 页面 | 标题、语义分组、焦点顺序、已验证字体缩放范围、减少动效 | 静态 + 读屏 |
| 控件 | role、name、state、disabled reason、命中区 | 静态 + 读屏 |
| 状态 | loading/empty/error/unknown 的可读说明；不得只靠颜色 | 状态矩阵 + 读屏 |
| 浮层 | 初始焦点、焦点陷阱、关闭后焦点回到触发源 | 交互 + 读屏 |
| 动态变化 | 状态变化播报一次，不重复播报 | 定向测试 + 人工 |

页面登记的 `layers.accessibility.facts`（旧称 `a11y` block）中的语义字段示意：

```json
{
  "ruleRefs": ["E1", "E2", "E3", "E4", "E5", "E6"],
  "semantics": ["page-title", "source-row", "status-badge"],
  "focusOrder": ["back", "search", "filters", "list", "footer"],
  "touchTargets": ["row-action>=44", "switch>=44"],
  "contrast": "text>=4.5:1",
  "fontScaleMax": null,
  "reduceMotion": "not_verified",
  "screenReaderLabels": ["statusBadgeLabel", "loginActionLabel"]
}
```

规则：

- 每个可交互控件必须有可访问名称、角色和当前状态；状态变化必须可播报。
- 分页正文的三个虚拟按钮使用实际正文视口，仅占中部 44vp 高的带区。视口宽至少 132vp 且高至少 44vp 时，每个按钮的语义区域均达到 44vp；更小视口内约束在原三等分和可用高度内，未测量或被覆盖时退出遍历。SDK 探针验证边界、标识及原有动作准入，读屏走焦与触发仍需原生核验。
- 连续阅读使用独立的 44vp 中心虚拟按钮打开控制栏。它沿用当前阅读输入准入和打开命令，正文列表继续持有滚动、触摸和段落语义。
- 浮层打开时焦点进入浮层；关闭后回到触发源；不得把焦点留在已卸载节点。
- 字体放大到 2.0× 时，关键操作、状态和关闭入口仍可达；不能靠裁切或覆盖通过。
- `fontScaleMax` 写已验证上限，不写设计目标；没有相关证据时填 `null`，未验证 2.0× 时不能填 2.0。
- 该验证上限不是平台配置或控件硬 cap。不得为了满足某个验收点，把更大的系统字号截到该值；平台继承配置、当前实际倍率、增长预算和正确字形按各自证据记录。
- `reduceMotion` 取 `supported` / `not_supported` / `not_verified`；未做动效偏好验证时填 `not_verified`，不能填 `true` 冒充支持。
- L3 的可访问性证据必须单独记账；静态断言不能替代读屏/设备结果。

### 6.11 操作与投影绑定

层 16 不只写“有 generation”，还要写页面动作绑定到哪个原操作。

```ts
interface OperationRef {
  operationId: string;
  owner: string;
  factSource: { path: string; symbol: string };
  identity: string;
  busyProjection: string;
  disabledProjection: string;
  bindingStatus: 'bound' | 'partial' | 'unbound';
  knownGap?: string;
  unknownPolicy: 'recovery' | 'reconcile' | 'block' | 'not-exposed';
  refreshPolicy: 'none' | 'read-only' | 'reload';
}
```

| 页面动作 | 绑定 | busy/disabled | unknown | 已确认写后刷新失败 |
|---|---|---|---|---|
| 列表读取 | 页面投影/读取 owner | loading / error | 不适用 | 重读，不重发写 |
| 启用/停用 | toggle operation | 行内 busy | Recovery | 只重读 |
| 登录 | login operation + `loginWeb` | 按钮 busy | 目标 Recovery；当前原 owner 未暴露 unknown 时登记 not-exposed/partial | 只重读 |
| 检测 | check operation | 行内 busy | 目标 Recovery；当前原 owner 未暴露 unknown 时登记 not-exposed/partial | 只重读 |
| 删除/导入 | mutation operation | 行内/页脚 busy | Recovery | 只重读 |
| 设置写入 | settings operation | 控件 busy | reconcile | 只重读 |

准入必须按动作意图与具体原操作区分，不能把一个写操作的blocked/unknown自动扩大到所有动作。已裁决允许独立诊断时，应登记当前实体、presentation和检测中去重规则，并保留底层事务准入。书源检测属于这类。每次检测捕获并等待先前写操作的屏障，屏障之后各检测可并发执行。结果应用前按当前书源定义重新校验。检测不修改书源配置，也不确认或重放原写回执。`source.check.run` 会写入诊断历史和阅读内容缓存，底层 `TRANSACTION_PENDING` 仍是有效失败事实。该裁决不自动授权其他页面或动作绕过写入门禁。

规则：

- `bindingStatus: bound` 表示 busy/disabled/结果都读原操作事实或原 owner 投影；`partial` 表示仍有页面行状态或局部投影参与，必须写 `knownGap`，不得计为统一操作绑定；`unbound` 表示没有绑定，不得进入 `PASS`。
- `unknownPolicy` 为封闭枚举。`not-exposed` 只表示当前原 owner 未向该动作暴露未知回执策略，必须同时使用 `bindingStatus: partial` 和非空 `knownGap`；它不是另一种已实现恢复策略，也不得写成 `bound`。`refreshPolicy` 仅允许 `none` / `read-only` / `reload`。
- 每个写动作必须有 `operationRefs`，并指向真实 owner 和事实源；没有绑定的写动作不得进入 `PASS`。
- 页面不得从“按钮已点”“页面已返回”“列表已刷新”推断写入成功。
- 已确认写后的刷新失败只允许重读；不得重新保存、删除或导入来“刷新”。
- 未知回执走 Recovery；不得用定时器或关闭浮层伪造成功。
- 旧世代回调只能作用于原实体；页面、书籍、来源或章节身份变化后必须失效。
- 编辑保存同时绑定读取时的完整实体版本与固定原操作 DTO。持久化 owner 在实际事务内核对前态，原操作重放复用原回执。编辑原文的格式必须保留既存规则及字段语义，缺少完整可编辑原文时由读取 owner 明确返回该格式限制并保留草稿。
- `disabledProjection` 必须来自原操作事实或原 owner 投影，不能由页面文案猜测；generation 在层 16 的身份/世代字段登记。

### 6.12 滚动坐标与恢复

层 5 的 `restore` 必须说明 owner、使用的 Native signed 或 normalized 坐标空间、单位、方向与原点，并绑定产生该坐标的 `contentStartInset` / `contentStartOffset` 和布局 revision。两种空间之间的转换只能由既有适配边界完成，不能把同名 `offset` 当作可互换的数据。

- Native List 设置起始 inset 后，顶部可能对应负的 raw offset；`scrollTo(0)` 不等于回到顶部，已保存的 raw `0` 可以是合法的部分滚动位置。恢复有效快照时保留符号；不得用 `Math.max(0, offset)` 抹掉负原点，也不得因值为 `0` 就当作“没有快照”。没有有效快照或策略明确回到顶部时，使用该列表既有的顶部语义入口。
- 锚点、实体/数据索引和 raw offset 分别归属其现有 owner。优先复用 Bookshelf 的已采用坐标薄适配或 Core 已有锚点能力；不另造跨页面通用滚动算法，不用 flat 行序号覆盖 Tree/Core 的节点锚点。
- 返回保留、筛选重置、空结果、宽度/字号变化须各有恢复策略。仅在布局身份匹配时复用像素；不匹配时按声明的锚点或顶部策略恢复。后继 presentation、旧 idle/frame 回调和用户新滚动须遵守现有失效规则，不能让旧恢复覆盖当前操作。
- 验证须覆盖实际登记的捕获→返回/恢复链，至少区分 inset 顶部、raw `0`、正 offset、空/筛选变化和退场后的旧回调。保留同一列表实例时须检查原实例；路由策略重建列表时须检查旧快照向当前有效实例的交接。声明值、薄适配测试与实际 Native 位置分开记账，列表新建截图或只测 normalized 非负数不足以证明返回保留。

## 7. 不变量

### 7.1 核心不变量

| ID | 类型 | 约束 | 等级 | 可例外 | 检查 |
|---|---|---|---|---|---|
| S1 | 结构 | 一页只有一个主滚动 owner | MUST / Blocker | 否 | 布局树 + 登记 |
| S2 | 结构 | 固定页头/页脚必须参与 content inset | MUST / Blocker | 否 | 几何探针 + 源码断言 |
| S3 | 结构 | underlap 必须声明遮挡补偿 | MUST / Blocker | 是 | 运行时 + 视觉 |
| S4 | 结构 | 浮层先消费返回，再退路由 | MUST / Major | 是 | 返回事件测试 |
| S5 | 结构 | 固定页脚存在时，状态页与末行仍可见 | MUST / Major | 是 | 状态矩阵 + 视觉 |
| S6 | 结构 | 路由/返回使用进入时捕获的父级与上下文，不从瞬时 route 推断 | MUST / Blocker | 否 | 源码断言 + 导航测试 |
| S7 | 结构 | 返回按登记的 backPolicy 集合消费：页面内临时层先于路由退出；平台宿主与页面的实际顺序按登记/实测，未验证时记 `unknown` | MUST / Major | 是 | 返回事件测试 + 登记 |
| S8 | 结构 | 返回保留策略必须与 RouteContract 的 retention/restorePolicy 声明一致；未实现时不得宣称已保留 | MUST / Major | 是 | 返回事件测试 + 登记 |
| B1 | 业务 | 同一动作单一语义 owner；多入口须有主次并共享 owner | MUST / Major | 是 | 登记 + 回调图 |
| B2 | 业务 | 陈旧回调不得作用于新实体/新世代 | MUST / Blocker | 否 | Host 测试 |
| B3 | 业务 | 可筛选集合必须有“筛选为空 + 清除条件” | MUST / Major | 是 | 状态矩阵 |
| B4 | 业务 | 进行中的操作必须暴露 busy/disabled，且不可重复提交 | MUST / Major | 是 | 交互测试 |
| B5 | 业务 | 消息类表面（短反馈/恢复/页态/确认/任务）必须绑定已登记消息入口；分类与生命周期以消息框架为准 | MUST / Major | 是 | 登记引用 + 消息入口检查 |
| B6 | 业务 | 平台宿主结果必须核对发起 identity；旧回调不得作用于新页面/新实体 | MUST / Blocker | 否 | Host 测试 |
| B7 | 业务 | 页面写动作必须绑定 operationId 和 owner；不得从 UI 推断写状态 | MUST / Major | 是 | 登记 + 源码断言 |
| B8 | 业务 | 已确认写后的刷新失败只重读，不重发写 | MUST / Blocker | 否 | Host 测试 |
| E1 | 表达 | 状态不得只用颜色 | MUST / Major | 仅历史页 | 读屏 + 静态 |
| E2 | 表达 | 触控目标 ≥44vp 或等效 response region | MUST / Major | 仅历史页 | spec/父预算 + 原生命中 |
| E3 | 表达 | 字体放大必须有增长预算，不得靠缩小文字规避 | MUST / Major | 是 | 增长预算 + 实际平台字号/字形 |
| E4 | 表达 | 正文/元信息对比度 ≥4.5:1 | SHOULD / Minor-Major | 是 | 对比度扫描 |
| E5 | 表达 | 每个可交互控件必须有可访问名称、角色和状态；状态变化可播报 | MUST / Major | 仅历史页 | 静态 + 读屏 |
| E6 | 表达 | 浮层焦点陷阱与关闭后焦点回到触发源 | MUST / Major | 仅历史页 | 交互 + 读屏 |

### 7.2 严重等级

| 等级 | 含义 | 处理 |
|---|---|---|
| Blocker | 数据/运行/结构不可接受，可能造成遮挡、错乱或错误写入 | 不得进入验收 |
| Major | 结构或业务语义违规，影响可用性/一致性 | 修复或登记例外 |
| Minor | 表达或体验问题，不阻断主流程 | 可排期，但必须登记 |
| Info | 观察项，不构成违规 | 记录即可 |

### 7.3 冲突裁决

1. 数据与运行正确性（S1、S2、S6、B2、B6、B7、B8）
2. 可访问性（E1、E2、E4、E5、E6）
3. 业务语义（B1、B3、B4、B5）
4. 结构完整性（S3、S4、S5、S7、S8）
5. 首屏预算与密度（第 3、8 层）
6. 视觉偏好（第 11 层）

低优先级不能覆盖高优先级。高优先级导致低目标不可达时，记录例外和补偿措施，不静默违反。

## 8. 预算

### 8.1 公式

```text
contentWidth   = min(viewport - safeInsets, prototype.maxWidth)
trailingWidth  = Σ(actionWidth_i(scale)) + gaps + endPadding
textMin        = max(titleMin(scale), metaMin(scale), statusMin(scale))

if textMin + trailingWidth > contentWidth:
    rowForm = twoLine | overflowMenu | detailEntry

rowHeight = max(baseHeight, textStackHeight(scale), trailingHeight(scale))
```

高度进入真实物理像素预算时，需求下界向外取整，可用容量向内取整并作为上界。光学优选尺寸在已支付需求与容量之间保留自己的取整规则。Geometry的高度fits与实际Scroll准入使用同一extent比较，数值容差只消除浮点算术误差。记录边界附近的原始需求、已付高度和pixel scale，避免同一微小欠付同时得到fits通过及可滚动两个结果。真实短窗和大字号溢出继续沿原自然流滚动。

### 8.2 校准流程

1. 首先冻结366×844基线；发生响应式行形态或控件预算变更后，增加实际窄宽边界（本试点320），不无条件扩为全宽度矩阵。
2. 用实际文本测量，取 `fontScale = 1.0 / 1.3 / 1.6 / 2.0`。
3. 记录 title、meta、status、action 的宽度与高度。
4. 生成行预算 spec，阈值由测量得出，不由页面作者填写。
5. 行形态空间不足时，评估按真实文字宽度换行、分层排版和有界滚动，并保持原动作与数据 owner。涉及移除业务动作或改变业务语义时取得对应产品裁决。

### 8.3 示例

书源页Stage 3基线：366 宽、328 内容、trailing 约 240；有登录时文字列只剩 88vp。正确结论不是“把文字列最小宽度设为 120”，而是“在某个字号阈值切换到两行、溢出菜单或详情入口”。这应由函数判定，不应由页面作者拍数字。Stage 4已接入三种自适应行与SDK预算矩阵；120×scale只是业务最低文字列策略，实际字形校准仍未验收，不把该数字当测量结果。

## 9. 页面登记

### 9.1 规范登记结构

`register.json` 的根结构固定为 `{schemaVersion: "1.0", modelVersion: "0.2", pages: [...]}`。每个页面含 `pageId`、`routeContractRef`、`prototype`、完整 `brief`、`source: {path, sha256}`、`layers`、`controlRefs`、`operationRefs`、`platformHosts`、`messageSurfaces`、`retainedScopeRefs`、`invariants`、`exceptions`、`revision` 和 `registryRevisions`。路由名由 `routeContractRef` 解析，不再在页面顶层重复 `route`。源码指纹绑定实际工作树字节，独立 registry revision 逐项锁定，不要求所有 registry 使用同一个数字。

同一页面族有多个真实装配宿主时，使用可选`variants[]`：每项必须声明`variantId`、生效`condition`、`host`及完整`registration`。`host`含`kind: route/embedded/selection`、唯一owner、继承的`routeContractRef`、`contextKinds`及实际装配`factSource: {path,symbol}`。每个registration独立具有16层、Brief、控件/操作/消息引用、22项不变量及消费修订，不允许递归variants；登记身份与variantId不得重复。它描述宿主差异，不增设业务路由。embedded模块不被强制画整页Header/Footer，整页原型推导记NOT_RUN；适用层的规则、引用和源码绑定仍照常校验。完整选择页的实际结构与Selection原型冲突则保留FAIL，不能改Brief或声明embedded来规避。

embedded豁免限于`regions: ["content"]`、没有独立页头与固定页脚的内容模块，仍允许模块内部的inline工具/状态区；宿主装配源码必须纳入SHA绑定。固定遮挡补偿登记测得的恒定值。动态补偿使用 `obscurationCompensation: null` 及 `obscurationCompensationSource: {path,symbol}`，绑定实际计算源码，并在 `headerInset` 写出其被滚动容器消费的方式。G-03 核对这项声明，S3 依原生几何、裁切和操作证据判定。常量及计算来源都未知时保留 G-03 NOT_RUN。已知不变量FAIL必须在所属层同步为FAIL，其他方面未验证不能把该层降回NOT_RUN。

可选`sourceInputs[]: {path,sha256,symbol?}[]`固定登记实际审读的装配/控件/业务来源；路径须在允许范围，引用与摘要逐变体检查，不代表已经捕获全部动态依赖。上游路由的view/query/scroll/selection保留策略为null时原样继承，代表未知，不能由页面补成false，也不能据此把route或S8记PASS。

页脚的`presence`仅说明是否存在；新登记另写`placement: fixed/inline/none`及条件`placementCondition`。固定页脚需单独测量和末端避让，入流页脚不重复扣固定inset。旧登记省略placement时沿用fixed解释，不能因schema升级而静默放宽已有固定页脚约束。

`layers` 必须且只能包含下表 16 个键。各层统一包裹为 `{applicability, owner, facts, result, evidence, knownGap?}`；`facts` 按层使用封闭的类型定义，不能用任意自由文本对象替代。

| 层 | 固定键 | `facts` 必填事实及类型 |
|---|---|---|
| 1 | `route` | `parentRoutes: string[]`；`parentCaptured: boolean`；`entrySources` / `backPolicy` / `platformHostRefs` / `unresolvedRefs: string[]`；`retention: {view, query, scroll, selection: boolean|null, draft: keep/discard/ask/unknown, basis: observed/target/mixed}`；`restorePolicy: fresh/resume/reload/reconcile`；`systemBackOwner: string`；`status: resolved/unresolved` |
| 2 | `scaffold` | `prototype: string`；`regions: string[]` |
| 3 | `informationArchitecture` | `blockOrder: string[]`；`firstScreenBudget: {viewportHeight: number, filterStackHeight: number|null, firstRowTop: number|null, unit: vp}`；`budgetStatus: declared/unverified/missing` |
| 4 | `header` | `role: Back/Home/Contextual/None`；`presentation: Fixed/Floating/ScrollAway/None`；`composition: string[]`；`surface: string`；`height: number|null`；`safeAreaOwner: string`；`actions: Action[]` |
| 5 | `scroll` | `owner: string`；`primaryCount: integer`；`headerInset` / `footerInset` / `restore` / `refresh: string`；`underlap: boolean`；`obscurationCompensation: number|null`；动态值另有 `obscurationCompensationSource?: {path,symbol}` |
| 6 | `content` | `unit: Row/Card/Grid/Canvas/Document/Form`；`rowForm: single-line/two-line/overflow-menu/detail-entry/none`；`slots` / `controlRefs: string[]`；`density` / `truncation: string`；`rowHeight` / `availableWidth` / `textMinWidth` / `trailingMaxWidth: number|null`；`budgetDeclared: boolean` |
| 7 | `query` | `placement: Inline/HeaderSlot/Overlay/None`；`entryPlacements: (inline/headerSlot/overlay/none)[]`；`applyTiming: live/submit/explicit/none`；`filteredEmpty` / `reset: boolean`；`normalization: string`；`filterSemantics: {filterId: string, definition: string}[]`；`actions: Action[]` |
| 8 | `footer` | `presence: boolean`；`placement?: fixed/inline/none`；`placementCondition?: string`；`actions: Action[]`；`safeAreaOwner` / `contentEndInset: string`；`controlRefs: string[]` |
| 9 | `overlay` | `types` / `hosts` / `zOrder: string[]`；`backConsumption: before-route/after-route/unknown`；`focusRestore: verified/unverified/missing` |
| 10 | `states` | `required` / `implemented` / `transitions: string[]` |
| 11 | `visual` | `typographyRefs` / `colorRefs` / `surfaceRefs: string[]`；`contrastRatio: number|null`；`contrastEvidence: string` |
| 12 | `interaction` | `controlRefs: string[]`；`actionStates: {controlRef: string, busyBound: boolean, disabledBound: boolean}[]`；`statusNonColor: boolean`；`targets: {minWidth, minHeight: number, equivalentResponseRegion: boolean}`；`focusStatus: verified/unverified/missing` |
| 13 | `adaptation` | `widthClass: compact/regular/expanded`；`fontScales` / `verifiedFontScales: number[]`；`orientation: (portrait/landscape)[]`；`theme: string[]`；`reduceMotion: string`；`budgetStatus: declared/unverified/missing` |
| 14 | `accessibility` | `ruleRefs` / `semantics` / `focusOrder` / `touchTargets` / `screenReaderLabels: string[]`；`contrast` / `reduceMotion: string`；`fontScaleMax: number|null` |
| 15 | `measurement` | `keys` / `geometryInputs` / `boundaries: string[]`；`revisionSource` / `cacheOwner: string` |
| 16 | `dataLifecycle` | `identity` / `generation` / `operationIds: string[]`；`serialization` / `stalePolicy: string`；`projectionConsistency: bound/partial/unbound`；`confirmedRefreshPolicy: read-only/replay-write` |

`Action` 为 `{actionId: string, owner: string, placement: header/query/footer/row, priority: primary/secondary/contextual/unresolved}`。完整枚举、数组去重/非空要求及条件约束以 [register.schema.json](../../tools/page-structure/schema/register.schema.json) 为准；表中字段与 `model.json.layers[].requiredFacts` 一一对应。层 1 的 facts 是所消费上游策略的检查快照，revision 绑定并核对一致性，不拥有第二套返回实现；`retention.basis` 同时存在于上游策略与页面快照中，必须相等。完整 RouteContract 另有上游 owner、sources 和 visibility 等字段。

包裹字段规则：

- `applicability` 只能是 `applicable` / `not_applicable`；后者必须有非空 `reason`，该层保留，不得删键或填空对象。
- `owner` 为负责该层事实的组件/模块；跨域事实引用上游 ID。
- `result` 只能是 `PASS` / `FAIL` / `EXCEPTION` / `NOT_RUN`；不适用也记 `NOT_RUN` 并以 reason 区分；`UNRESOLVED` 是 knownGap 原因，不增加第五种结果。顶层 `invariants` 每项为 `{result, reason, evidence, followUp?}`，不能只填结果字符串。`FAIL` 必须有 `followUp: {owner, reviewTrigger, exitCriteria}`；保持失败并写明责任与退出条件，不需要伪造例外或补偿措施。
- `evidence` 是 `{kind, path, symbol?, result}` 对象数组，kind 区分源码、定向方法、demo、设备和读屏等证据；没有证据时可为空，但不得据此记行为或视觉 PASS。目标值、声明值、实测值必须使用不同字段。
- `knownGap` 说明已知缺口及问题/后续阶段入口。`FAIL` 必须能定位到规则和任务；例外必须引用 exceptions 中的有效记录。尚未实施的未来修复不算当前补偿措施；没有可验证补偿时保留 FAIL，不能仅因排期赋予 EXCEPTION。
- `registryRevisions` 按契约地图、导航、控件、平台等登记分别记录所消费版本；检查逐项一致性，不把独立 revision 强行同步。

完整、可验证的书源页实例见 [register.json](../../tools/page-structure/register.json)。该文件登记实际源码状态，包含仍为 FAIL/NOT_RUN 的层与不变量；不得把登记文件存在或 schema 通过解释为页面通过。所有业务说明均以正式字段表示，不保留另一套 choices/a11y 模板。

### 9.2 登记规则

- `register.json` 是页面结构的机器事实源；本文档解释规则。
- `layoutEvidence: {path, sha256}` 是可选的冻结布局探针报告引用；缺少匹配报告时，E2/E3不能从声明布尔或手填尺寸升级为PASS。报告固定由 `tools/test-source-management-layout.mjs --case matrix` 生成，按宽度320/366与字号1.0/1.3/1.6/2.0逐点登记SDK目标尺寸和row/chip/footer预算；每个已声明输入的字节指纹须仍匹配。局部控件SDK属性通过不等于整页E2通过，也不能证明原生命中、裁切或像素行为。
- E3报告为PASS还必须提供 `nativeEvidence: {path, sha256}` 冻结原生测量manifest。manifest声明同一pageId、覆盖同一宽度/字号矩阵，生产输入指纹与报告一致，`measurementProvider` 仅允许 `reader-native-text-node` / `reader-native-page-capture`，且非空samples逐项对应预算的原生文字尺寸。仅将 `measurementKind` 改成native不满足条件。哈希校验只能证明回执字节和输入关联；采集是否真实发生、provider来源是否可信仍需依据原始采集流程审阅，不能把哈希或字符串标签当作原生验证本身。
- 每个页面必须有 16 层对应的登记字段，不能只写“同某某页面”。
- 每个 `FAIL` 必须对应修复任务或例外；不能留空。
- 页面变更必须更新 `revision`，并保留 diff 说明。
- 登记不是实现说明文档；不要写组件内部实现细节。
- 产生用户可见消息的页面必须登记 `messageSurfaces`，每项引用 `tools/message-entrypoints.json` 的入口 ID；不得只写组件名。
- 消息的 category、effectiveHost、retireRule 不在页面登记里复写；变更时更新消息入口清单，页面登记只更新引用和 revision。
- `layer` 只表示该消息表面所属的页面结构层；实际挂载宿主以消息入口清单的 `effectiveHost` 为准。
- `validate-model` 只检查消息引用存在与层级一致；消息分类/生命周期行为由消息框架检查和定向测试负责。

跨契约引用规则：

- `routeContractRef` 必填，并解析到 `tools/contracts/navigation-registry.json`；`layers.route.facts` 保存所消费的策略检查快照，必须与该 registry revision 对齐，不拥有返回逻辑。任一保留项未冻结时，上游 `status` 写 `unresolved` 并填 `unresolvedRefs`，该页层 1 不记 `PASS`。
- `brief.platformSet` 与 `platformHosts[].hostId` 必须一一对应；`layers.route.facts.platformHostRefs` 与 `platformHosts[].hostRef` 必须一致；多一项或少一项都是 `FAIL`。平台宿主不进入路由列表。
- `platformHosts[].hostRef` 必须解析到 `tools/contracts/platform-host-registry.json`；页面存本次 intent、identity、returnContext、业务 owner 和结果策略引用，不复制宿主生命周期。`businessOwner` 是发起业务动作的 owner，不是宿主生命周期 owner；后者只在 `platform-host-registry.json` 登记。
- `platformHosts[].businessOwner` 为必填，须与该 `intent` 对应的 `operationRefs[].owner` 相同。`resultPolicy` 是封闭枚举数组，仅允许 `completed` / `cancelled` / `error`，并须与所引用宿主登记的集合一致。当前 `loginWeb` 以 Promise 完成/取消/失败暴露结果，没有独立 `unknown` 结果；页面不得在登记中编造平台回执。未知写回执属于原操作的 `unknownPolicy`，不由平台结果数组推导。
- `retainedScopeRefs` 引用消息登记中仍保留且由本页负责的 `retainedScopes[].scope`；页面没有此类项时用空数组。引用存在与保留声明正确性分开检查；选定文件检查不能通过丢弃全部 retainedScopes 隐藏缺口。当前 `statusBanner` 源码仍保留时，须引用其 `retained-unreachable` 登记；只有源码与对应测试引用一并退役后才删除该引用。
- 每个交互控件必须在顶层 `controlRefs` 中出现，并解析到 `tools/contracts/control-registry.json`；各层 `layers.*.facts.controlRefs` 是顶层集合的子集，不能出现层内引用但顶层缺失。控件状态集、命中区和可访问名称由控件契约提供。
- 完整目标清单须从当前可达builder及其共享绘制宿主展开，包含条件空态动作、读取重试、原操作核对/继续、通知展开、选择项及外点关闭；共享组件名或常态截图不能代替这些条件模板。非交互行/徽标属于内容引用，外点关闭属于区域交互，须分别说明44vp按钮规则的适用性。每个模板保留控件引用、事件owner、准入身份和原生待验证项；展开/收起等局部动作同样拒绝旧generation。
- 证据输入须绑定实际读取的页面、共享规格、probe及前置dirty依赖；本批修改清单与只读依赖清单分别说明。测试进程隔离、SDK声明尺寸、真实系统字号、原生边缘命中各有独立结论；四个循环标签不构成四个实际字号样本。全页E2不能由局部尺寸报告关闭，新增目标族须同步覆盖检查所消费的集合。
- 每个写动作必须在 `operationRefs` 中出现，并指向真实 owner、事实源、identity 和 `unknownPolicy`；没有绑定的写动作不得进入 `PASS`。
- `layers.states.facts.required` 对齐 `brief.stateSet`，`implemented` 登记实际支持状态；两者的目标差异必须标 FAIL/knownGap，不能为凑一致补写未实现状态。
- `layers.accessibility.facts` 必填；`ruleRefs` 必须解析到本文档的不变量 ID；状态徽标、图标按钮、开关应登记实际 `screenReaderLabels`，缺失记 FAIL。
- `validate-model.mjs` 检查引用字段存在、枚举、层级一致和 16 层完整性；`check-contract-refs.mjs` 解析跨文件引用、重复 owner、未登记宿主和未绑定写动作；`check-register.mjs` 检查登记与源码/注册表绑定。三者都不能替代 L2/L3 行为与读屏证据。
- 示例中的 `source.toggle`、`source.login`、`source-row` 等是示意 ID；落地时以实际 owner、事实源和控件登记为准，不能把示例当成新契约。

### 9.3 更新协议

1. 修改 Brief 或 Choice；若路由、平台宿主、控件状态、操作事实或无障碍事实变化，先更新对应上游契约或引用，再改页面。
2. 重新推导并 diff。
3. 分类每个差异：合法变体 / 违规 / 例外。
4. 更新不变量状态。
5. 更新 revision 和变更说明；检查 `routeContractRef`、`controlRefs`、`operationRefs`、`platformHosts`、`messageSurfaces`、`layers.accessibility.facts.ruleRefs` 无悬空引用。
6. 重新运行 L0/L1；必要时补 L2/L3。

## 10. 组件映射

| 层 | Owner | 允许变体 | 当前缺口 |
|---|---|---|---|
| 路由 | Index / 导航契约 | root / secondary / reader / captured-parent | 可见/保留路由已登记；NAV-07/08 与平台返回行为仍未冻结/未验 |
| 平台宿主 | 平台适配 owner | filePicker / loginWeb / nativeAlert / share / mediaSession | 已登记书源登录、书源工具的系统确认和文件保存、小说详情和选文分享。平台行为的证据范围见各宿主登记。 |
| 页头 | PageBackBar / AppTopBar | standard / floating / home | 书架/搜索私有头重复；AppTopBar 有未使用模式 |
| 滚动 | ReaderPageScaffold | fixed / floating / scrollAway | 无跨页 inset 断言 |
| 查询 | ReaderSearchField / ReaderSelectPanel | inline / header / overlay | 决策表已落地；跨页登记与首屏预算待扩展 |
| 状态 | ReaderPageState / Recovery | loading / empty / error / unknown | 书源 filteredEmpty 已接现有 PageState；全页状态覆盖未验 |
| 浮层 | SheetChrome / DialogSurface / SelectPanel / Feedback | sheet / dialog / panel / toast / recovery | 选型规则已登记；全页内容排版/焦点行为未验 |
| 消息 | `ReaderTransientFeedback` + `ReaderTransientToast` / `ReaderRecoveryNotice` / `ReaderPageState` / `ReaderNativeAlertOwner` | transient / recovery / page-state / confirm | 书源4个实际入口已引用；分类与生命周期仍归消息框架 |
| 控件 | ReaderControlSpecs / ReaderButton / ReaderFormField / ReaderChoiceRow / ReaderSearchField / ReaderSelectPanel / ReaderToggle | button / icon / toggle / field / chip / row-action / tab / search / select | 书源最小集已登记；命中区/字号缺口仍在，全量未覆盖 |
| 操作 | Host / Orchestrator / Projection / `ReaderOperationFacts` | read / write / task / recovery | 书源动作已绑定ID与事实源；login/detect仍为partial |
| 无障碍 | 页面与组件、无障碍契约 | semantics / focus / touch / contrast | 书源类型化facts已登记；读屏/焦点/2.0×未验 |
| 行 | 页面私有；书源为SourceManagementLayout | row / card / grid | 书源已接入单页自适应预算；无第二消费者前不建通用行骨架 |
| 几何 | ReaderPageGeometry / ReaderScrollLayout | — | 内容行无预算；inset 无断言 |
| 测量 | ReaderMeasurementStore | — | 内容区测量键未统一 |

规则：

- 新组件必须先映射到层和 owner，不能先写组件再补理由。
- 共享组件只承担共享语义；页面私有差异用参数/插槽表达，不能复制外壳。
- 同一组件可以映射到多个层（如 `ReaderSelectPanel` 同时涉及查询和覆盖层），但每层只登记该层事实，不复制另一层的状态机。
- 页面不得自建页头、页脚、浮层外壳、状态外框来绕过 owner。
- 消息组件映射以 `docs/message-ui/FRAMEWORK.md` 和 `tools/message-entrypoints.json` 为准；本表只记录层归属，不重定义类别。
- 路由、平台宿主、控件、操作和无障碍先引用上游 ID；页面不得把上游状态机复制成页面私有实现。
- 平台宿主由平台或平台适配 owner 绘制，页面只登记 `hostId`、intent 和回程；不得为平台表面添加第二层外框。
- `controlRefs`、`operationRefs`、`layers.accessibility.facts.ruleRefs` 必须解析；新增控件或操作先登记契约，再进页面。
- 共享组件改动必须有影响页面清单、定向测试和回滚方案。

禁止：

- 页面私有 mask 冒充固定页头。
- 页面自建 Toast/Alert/Recovery。
- 同一浮层类型出现多个不共享的宿主。
- 直接手改主题注册表来绕过 token。
- 为单个页面修改共享 spec 而不做影响分析。

## 11. 例外与版本

### 11.1 例外记录

```json
{
  "id": "EX-001",
  "pageId": "source-management",
  "invariantId": "E3",
  "reason": "字体放大后行形态切换需要先完成测量校准",
  "owner": "harmony-ui",
  "compensatingControl": "1.6× 下允许纵向滚动，状态与操作不裁切",
  "sinceVersion": "0.2.0",
  "expiresAtOrReviewTrigger": "行预算 resolver 落地或 2026-12-31"
}
```

### 11.2 例外规则

- 无 owner、无理由、无补偿、无退出条件的例外不成立。
- 例外只对声明的页面实例有效，不能复制到新页面。
- 到期自动视为失败，不能静默续期。
- 不可例外项：S1、S2、S6、B2、B6、B8。
- 可访问性例外只允许历史页面，并必须有到期时间。

### 11.3 版本

| 版本 | 内容 |
|---|---|
| 模型版本 | 语法、决策表、不变量、预算公式 |
| 登记版本 | 每页 `revision` 与变更说明 |
| 例外版本 | 例外集合与到期状态 |
| 契约版本 | `tools/contracts/contract-map.json` 的契约 ID、owner、status、machine source |
| 上游版本 | 导航/控件/平台宿主/消息/操作登记自身的 revision；页面只记录引用 |

变更流程：

1. 提出变更：影响哪些层、哪些页面、哪些不变量。
2. 生成 diff：模型 diff + 登记 diff。
3. 影响分析：共享组件、页面、测试、视觉。
4. 重新推导：所有受影响页面重新跑决策函数。
5. 更新登记与例外。
6. 运行 L0/L1；按需 L2/L3。
7. 记录证据边界。

## 12. 开发流程

### 12.1 新建页面

1. 写 `PageBrief` 和 `RouteContract`，标记所有未知字段。
2. 按 4.1 选择原型。
3. 按第 6 节推导路由、页头、查询、主操作、浮层、行形态、控件状态、状态矩阵。
4. 检查 4.3 非法组合。
5. 解析上游引用：`routeContractRef`、`controlRefs`、`operationRefs`、`platformHosts`、`messageSurfaces`、`layers.accessibility.facts.ruleRefs`；缺登记先补上游，不先写页面。
6. 填 `register.json`，不写“同某某页面”。
7. 按第 10 节选择 owner，不新建私有外壳。
8. 实现后跑 L0/L1 和引用完整性；补 L2 测试。
9. 出 366×844 实际 demo；设备对比、读屏和字体缩放按授权执行。
10. 更新登记与证据，列出改动页面清单和未执行的 L3 项。

### 12.2 修改页面

1. 更新 Brief 与 `RouteContract`，说明变更原因；路由/返回/保留变化必须落在 RouteContract 字段上，不能只改实现。
2. 判断变更是否触及上游契约：路由登记、控件 spec、操作事实、平台宿主、消息入口、geometry/token。触及则先更新上游登记，再回写页面引用。
3. 重新推导，记录与当前结构的 diff。
4. 把每个 diff 分类为合法变体、违规或例外。
5. 只修违规；不做顺手重设计。
6. 补/改定向测试；新增或变更的 `controlRefs`、`operationRefs`、`platformHosts`、`layers.accessibility.facts.ruleRefs` 必须有引用解析测试。
7. 更新登记、revision、不变量状态；失效引用按 FAIL 处理，不降为 `NOT_RUN`。
8. 视觉/读屏/字体缩放 gate；未执行则记 `NOT_RUN` 并写明复审触发条件。

### 12.3 评审

评审必须回答：

- 原型选择是否由 Brief 推导？
- 16 层是否有空项？
- 是否存在 4.3 非法组合？
- 父级和返回是否来自捕获的上下文，而非瞬时 route？
- 平台宿主是否被误登记为路由或重画了平台外框？结果是否校验捕获身份？
- 每个写操作是否绑定 `operationId`/owner？刷新失败是否只重读、不重发写？
- `controlRefs`、`operationRefs`、`platformHosts`、`layers.accessibility.facts.ruleRefs`、`messageSurfaces` 是否全部可解析？有无悬空引用？
- 每个 FAIL 是否有修复或例外？
- 改动是否只影响声明页面？
- 视觉/可访问性是否有实际证据？L3 未执行是否显式记 `NOT_RUN`？
- 事实变化是否通过原控件的实际 SDK child updater 同时更新视觉与语义，而非新建快照？滚动快照是否声明 signed/normalized 空间与 inset 原点？
- 44vp response 是否由 carrier/父预算支付并核对 clip？系统字体的配置事实、稳定后 UIContext 和正确字形是否分别有证据？
- 上游契约是否被重复定义或绕过？
- 是否报告了未改动的相似页面？

### 12.4 共享组件变更

1. 先判断变更属于哪个上游契约（geometry、surface、control、message、operation），更新其登记；页面结构契约只引用契约 ID。
2. 映射到层与 owner。
3. 列出所有消费者页面。
4. 做影响分析：布局、状态、a11y、字体缩放、命中区、平台宿主。
5. 先加法后改法：优先新增可选参数，避免改变默认行为。
6. 更新所有受影响页面的登记、引用与测试；引用失效的页面记 FAIL。
7. 共享变更与页面变更分开记账。
8. 涉及消息组件时，分类、宿主准入和清理按消息框架执行，页面登记只更新入口引用；不得新增同类外框。
9. 涉及控件时，状态集与命中区以 `ReaderControlSpecs` 或登记控件为准；页面不得私有覆盖默认 busy/disabled 语义。
10. 不得以“页面需要”为理由在页面内私建平台宿主、消息外框或控件 spec 副本。

### 12.5 紧急修复

紧急修复也必须登记；可以延后 L3，但必须记录 `NOT_RUN` 和后续复审条件。不能因为紧急而绕过 S1、S2、S6、B2、B6、B8。

### 12.6 完成定义

一个页面结构变更完成，必须同时满足：

- 登记完整，16 层无空项；
- MUST 全部 PASS 或有例外；`S6`、`B6`、`B8` 不允许例外；
- `RouteContract` 完整；`status: unresolved` 时必须写明 `unresolvedRefs`，且层 1 不得记 PASS；
- `brief.platformSet` 与 `platformHosts` 一一对应；每个宿主有身份、返回上下文和 `backPolicy`；宿主未被画成路由；
- `controlRefs`、`operationRefs`、`platformHosts`、`layers.accessibility.facts.ruleRefs`、`messageSurfaces` 全部可解析，无悬空引用；
- 每个写操作绑定 `operationId` 与实际 owner；UI 不自行推断 busy/disabled/成功；
- 消息表面已绑定 `tools/message-entrypoints.json` 入口；
- 定向测试通过；
- 状态变更保留同实例更新证据，滚动恢复说明坐标空间/inset 原点；局部 SDK 属性不能替代原生边缘命中和真实位置；
- 366×844 demo 已出；
- 设备对比已执行或明确 `NOT_RUN`；
- 读屏/焦点/2.0× 字体缩放已执行或明确 `NOT_RUN`，不得用源码断言冒充 L3；
- 改动页面清单已报告；
- 版本号未被擅自修改。

层 1 `unresolved` 或其他 MUST `FAIL` 时，只能记“修复与登记闭环”，不能记“页面结构变更完成”。闭环记录必须写明未冻结项、owner 和下一阶段入口，不得用“已登记”替代“已通过”。

## 13. 合规与证据

| 证据 | 能证明 | 不能证明 |
|---|---|---|
| 源码/登记 | 结构声明、owner、规则引用 | 实际渲染、设备行为 |
| 契约地图 | 上下游 owner、状态、机器事实源是否声明 | 契约内容正确、页面实现符合 |
| 路由/控件/平台宿主登记 | 引用可解析、字段完整、状态集/命中区/宿主身份已声明 | 实际返回时序、平台 Back 顺序、真实命中体验 |
| 操作引用登记 | 写动作绑定到 operationId/owner，未由 UI 推断 | 真实写入成功、串行与回执行为 |
| Node/单元测试 | 决策函数、状态、静态断言、引用完整性 | 视觉、字体缩放、读屏、平台调度 |
| 消息入口清单/检查 | 消息分类、宿主、准入、清理登记；未登记出口 | 页面结构布局、视觉、业务可达性 |
| SDK probe | 实际生成的同实例 child updater、子组件属性更新、布局/语义声明、测量回调 | 合成像素、用户观感、原生命中或读屏播报 |
| 366×844 demo | 单尺寸视觉 | 真机字体、安全区、设备差异 |
| 设备截图 | 真机视觉 | 全状态、全字号、用户验收 |
| 当前原生目标树 + 边缘点击回执 | 已测目标的 bounds/response/父预算、当前实体唯一派发 | 未执行模板、整页 E2、业务或平台宿主验收 |
| 读屏/焦点记录 | 已测路径的可访问语义与焦点顺序 | 未测路径、动态状态全覆盖 |
| 用户验收 | 最终接受 | 未覆盖页面 |

证据分开记账：代码、测试、契约引用、消息入口、demo、设备、读屏、用户验收。上游通过不代表下游通过。

系统字体还须分开记录平台继承配置、初始/更新事实、当前宿主布局稳定后的 UIContext 读回与实际字形；回调刚发生时的旧读回应保留为过渡观察，不能被目标值覆写。已验证倍率不自动成为硬上限，也不能推及未测路由。

同实例更新、signed 滚动坐标、命中父预算和字体继承的上述说明是 v0.2 的语义澄清；不新增规则 ID、模型版本或默认自动门禁，不改变 E2 阈值，也不将已有局部 Native 证据提升为整页通过。后续状态与实际执行范围见[结构问题修复实施方案](../issues/page-structure-fix-20261102.md)；历史冻结证据保留原文，纠正采用追加说明。

页面结构 validator 只校验 `messageSurfaces` 等引用的存在性和层级一致；消息入口检查只在实际变更消息入口时执行；路由/控件/平台宿主登记的正确性由各自 owner 负责。三者结果分别记账，不能互相替代，也不能把结构登记通过当作消息生命周期、控件行为或平台调度通过。

平台宿主证据只能证明“已发起并校验了哪次身份”；平台成功不等于业务成功，平台取消不等于业务失败。原生 Back 是否先于应用处理属平台证据边界，未实测时记 `unknown`/`NOT_RUN`。

## 14. 当前采用状态

### 14.1 v0.2 覆盖

- 详细原型：SecondaryCollectionPage、RootTabPage、ReaderPage。
- 语法级原型：SecondaryDetailPage、CompoundSearchPage、SelectionPage。
- 试点页面：书源管理（首轮闭环）、书籍目录、下载管理（Stage 5正式登记，未通过全层验收）。
- 消息框架：作为层 9/10 的上游依赖并入；页面登记引用 `tools/message-entrypoints.json`，不复制分类和生命周期。
- 路由/返回/保留：以 `RouteContract` 进入层 1；引用 navigation registry，不复制 navigation-comparison 的叙述矩阵。
- 控件状态：以 `controlRefs` 进入层 6/8/12；状态集和命中区归 `ReaderControlSpecs` 与登记控件。
- 无障碍：以 `a11y` 块进入层 14；E5/E6 成立，但 L3 证据仍需单独记录。
- 操作绑定：以 `operationRefs` 进入层 10/16；写动作必须绑定 `ReaderOperationFacts` 语义和实际 owner。
- 平台集成：以 `platformHosts` 进入层 1/9；平台宿主不是路由，结果需校验捕获身份。
- 首轮建设以框架为主要交付：模型、16 层 schema、契约地图、路由/控件/平台宿主登记、页面登记、例外账本和 validator 先于书源页生产代码落地；书源页是第一个校准样本。
- 首轮建设必须在书源页上证明四件事：同一 Brief 推导同一结构；16 层 schema 无省略项；引用全部可解析；真实页面能完成“登记 → 发现 → 裁决 → 修复 → 验证”。前三件由框架 Stage 1–2 证明，第四件由书源试点 Stage 3 证明；不以框架 PASS 代替试点闭环。
- 基线：366×844；字体缩放验收点 1.0 / 1.3 / 1.6 / 2.0。
- 当前 App 版本：0.2.0 / versionCode 1000000；本契约不改变版本。

### 14.2 尚未覆盖

- 宽度矩阵、平板、横屏、折叠屏。
- 跨平台页面一致性。
- 全量页面登记（本轮扩展为书源、目录、下载及书源工具四个页面族；其余路由的实际挂载清单已列出，尚未全量迁移）。
- 全量可访问性审计；E5/E6 之外的角色/对比度/动效偏好仍属后续。
- 组件级视觉重设计。
- 自动静态检查的全部规则。
- observability/性能预算与 i18n 契约。
- 平台宿主的真实 Back 时序与系统调度验证。

### 14.3 历史试点结果与开放项

以下记录保留早期源码、预览和方法证据的原时点结论。2026-11-12 合流采用新的 UI 目录、SourceJourney owner 和 Native Button carrier，当前登记及逐项复验结果以 [合流实施记录](framework-confluence-20261112.md) 为准。

框架与试点的逐项执行结果见[实施方案](../issues/page-structure-fix-20261102.md)第14节。v0.2 已落地契约地图、13条可见/保留路由登记、书源控件/平台宿主最小集、16层schema、真实页面登记、推导及校验工具。前轮41-case结果保留；本次审计修正后，7组JSON/schema与引用校验通过，扩展为55个框架定向case通过，覆盖policy枚举、业务owner、保留策略basis、保留消息引用与失败项followUp等新增负对照。这些结果证明模型/引用与所测检查机制，不提高上游契约成熟度，也不证明平台或页面视觉通过。

书源页Stage 3修复与登记闭环已完成，16条完成标准逐项见实施方案第14.8节；Stage 3闭环时生产源码为 `6aa9546a5808256fb86ff2897a0346d24ec9c9402378a439f51b6e800fa324c3`。除已过的方法/SDK/消费者场景外，本轮补齐login-session方法证据及366×844默认列表、筛选空、登录busy三态原生CPU Previewer demo。字体沿用实际ReaderFonts/ReaderFontLoadHost checked回执后才创建页面；原字体准入失败帧保留。该闭环不等于页面整体结构合规或产品交付通过。

D1按用户决定保留入口，FIX-01延后；D2已移除未使用prop。设备、读屏、焦点与2.0×仍为 `NOT_RUN`；S8/E2/E3仍 `FAIL`，B4整页仍 `NOT_RUN`。预览使用样本数据、零OS inset、density/fontScale=1、有限平台端口，未执行HAP构建、签名、安装或用户验收。证据入口为本机 `.reader-artifacts/page-structure-stage3-20261102/evidence.json`，不把native fixture当作实际手机旅程。

已登记的已知未决项：

- `NAV-07`按用户保留决定实现同Runtime四项筛选和Scroller锚点快照，fresh进入回到默认；按sourceId恢复，删除回退邻近序位，窗口/字号改变不复用旧像素，用户触摸和后继presentation取消旧帧，帧间重排重新定位。实际Index/Source方法及有限Scroller测试通过，不代替原生往返/位置验收。`NAV-08`当前Tools owner原本保留sameRuntime普通草稿、选择、检测参数及结果，已补方法证据；不另写一套owner，外层Scroll不承诺保留。
- E2触控目标、E3字体增长预算仍为 `FAIL`；尚未落实/未验证的未来补偿不构成有效例外。
- D1本轮保留入口，入口主次/上下文未冻结，B1记 `NOT_RUN`；不能因延期改成PASS或有效例外。
- B4按动作保留证据边界：原写blocked/unknown允许诊断，仍受当前挂载/实体/单飞及捕获presentation准入。Source owner已补任务token、可用sourceVersion和完整定义前后校对，陈旧resolve/reject/finally不得覆盖后继；旧编辑JSON对已观察到的启停/删除/定义变化不再派发。Core import/check没有expected-version/CAS参数，读边界之间的外部并发不宣称原子隔离；Core事务/缓存门禁不绕过，未覆盖动作和平台仍独立NOT_RUN。
- 平台宿主 `loginWeb` 的返回时序未实测，`backPolicy` 为 `unknown`，S7记 `NOT_RUN`；B6调用方sourceId/session陈旧回调已由login-session方法用例验证，按此边界记PASS；ArkWeb内部request/surface与真实平台行为仍NOT_RUN，不能与Back顺序互代。
- 目录页与书源页的查询位置差异属合法变体；目录已按四类实际宿主及页脚分支正式登记，查询提交/即时模式分别记录。
- 下载页D3已由用户裁决为常态列表，实施见方案14.15：标题随List滚动，管理态Footer独立预算；该页已完成16层及普通/管理变体登记，原生证据仍未完成，不再沿用未裁决的旧hybrid说明。

Stage 4追加证据纠正：Stage 3成功三帧的checked字体回执在本机Previewer实际为mock；未见原生`LoadFontFromList / Load Success`，因此上文“沿用实际字体”只成立于资源输入/owner调用，实际Reader字形加载未经证明。Stage 3三态内容证据保留，字体/材质不作为通过依据。Stage 4改走真实平台字体register并核原生日志时间线；详情与结果只追加实施方案，不改旧冻结manifest。原生系统字号setter也未生效，metrics DTO不得冒充2.0×整页渲染。

Stage 4代码与本地验证结果见实施方案14.10：共享source控件由44vp基高增长，行/筛选/页脚父预算接入；32行组合、11消费者与新预算正反检查通过。页面登记revision6、control revision3，E2局部SDK尺寸与E3几何预算均不等于全页通过。原生8字体加载已确认，但variable字体在最小对照仍paint失败；节点数值不能证明正确字符字形，E2/E3和原生验收继续开放，19项消息失败保持原账。

共享影响复核见实施方案14.11：ReaderSelectPanel及两个filter原定义在Stage 3/4冻结输入中相同，不能由累计dirty diff归因为当时批次修改。14.11先将既有1.6上限登记为`SHARED-FONT-CAP-01`，没有将旧测试当E3或批准例外；2026-11-03的14.12随后同时取消spec与搜索局部上限、接当前scale并修父预算，而不是只删一个字段。

14.11补证已通过specs、外观retained-lifecycle四组合、真实appearanceLibrary Panel五旅程与InlineSelect input-selection；修复的是当前probe依赖和场景前提，没有改生产策略。完整外观生命周期的NativeChild边界、真实Panel/ChoiceRow选择链及原生字形证据分开记账，不能互代。

14.12共享上限修复已通过四字号/两个宽度的三个消费者SDK快照、同一actor live1→2、草稿/Apply/关闭和退出observer回归；修复了嵌套ForEach旧action读取新opening的约束缺口。原生多行hint未知时等待实际Area，测量叶在限高视窗外；per-part key只含真实尺寸/内容输入，无关窗口高度/安全区变化不清同形状尺寸。SDK快照只证明key/回执协议，不证明原生reconciliation/字形。`SHARED-FONT-CAP-01`为代码修复/SDK通过、原生仍OPEN；register revision7，E2/E3继续FAIL。旧native快照是历史候选，不再代表当前common字节。

继续引用Stage 3旧manifest/预览时，以[实施方案](../issues/page-structure-fix-20261102.md)14.9的字体证据更正为准。冻结原件保留其历史字节，实际Reader字形仍需对应原生证据。

## 15. 术语

| 术语 | 含义 |
|---|---|
| PageBrief | 页面业务事实输入 |
| Prototype | 页面原型，6 类之一 |
| Grammar | 原型合法/非法组合 |
| Choice | 从 Brief 推导出的层选择 |
| Register | 每页 16 层实例记录 |
| Message surface | 页面中产生消息类表面的位置，必须引用消息入口 ID |
| Contract map | 上下游契约的机器索引：contractId、owner、事实源、状态、消费者 |
| RouteContract | 单页路由/父级/入口/返回策略/保留策略/系统 Back owner 的输入契约 |
| Platform inheritance | 应用消费系统能力（安全区、系统 Back、IME、字体缩放、深色、读屏、生命周期），不重写 |
| Platform integration | 应用把业务意图交给平台宿主（文件选择、登录 Web、原生确认、分享等），再校验身份并回到捕获上下文 |
| Platform host | 平台拥有的交互宿主；不是应用路由，不画第二层外框，Back 顺序默认 `unknown` |
| ControlRef | 页面控件对已登记控件/spec 的引用；含状态集与命中区要求 |
| OperationRef | 页面写动作对 operationId、owner、事实源、身份/世代、busy/disabled 投影的引用 |
| Binding status | `bound` / `partial` / `unbound`；`partial` 必须写 `knownGap`，`unbound` 不得 PASS |
| Unresolved | 规则或登记项无法判定/未冻结；不是 PASS，也不能用自由文本替代 |
| A11y rule ref | 无障碍规则引用；页面声明语义与焦点，不复制规则正文 |
| Invariant | MUST/SHOULD/MAY 规则 |
| Owner | 负责实现/约束的组件或模块 |
| Legal variant | 由 Brief 或例外解释的差异 |
| Violation | 无规则解释的差异 |
| L0–L4 | 合规检查层级 |
| Blocker/Major/Minor | 违规严重等级 |
| Exception | 有 owner、理由、补偿、到期的例外 |

## 附录 A：16 层评审清单

- [ ] 1 路由与返回：`RouteContract` 完整；父级来自捕获上下文；`backPolicy` 集合与消费顺序明确；`retention`/`restorePolicy` 与实现一致；平台宿主不是路由且未画第二层外框。
- [ ] 2 骨架：原型由 Brief 推导；区域完整。
- [ ] 3 信息架构：区块顺序合理；首屏预算有依据。
- [ ] 4 页头：角色/呈现/组成/表面/高度已登记。
- [ ] 5 滚动：单一主滚动；inset/underlap 正确；位置恢复已声明。
- [ ] 6 内容单元：行/卡/网格选择有依据；`controlRefs` 可解析；槽位/预算/截断明确。
- [ ] 7 查询筛选：位置由 queryPriority 推导；有 filteredEmpty + reset。
- [ ] 8 页脚：主操作单一 owner；`actionRefs`/`controlRefs` 可解析；多入口的主次/上下文有依据；安全区正确。
- [ ] 9 覆盖层：选型符合条件；使用登记宿主；消息入口与 `platformHostRefs` 已登记；关闭/返回正确。
- [ ] 10 状态：矩阵完整；转换明确；旧内容策略与消息通道正确；busy/disabled 来自 `operationRefs`；刷新失败不重发写。
- [ ] 11 视觉：字阶/对比度/表面/圆角符合 token。
- [ ] 12 交互：触控目标、状态、反馈、焦点完整；控件状态集与命中区符合引用。
- [ ] 13 适配：字体缩放有预算；宽度/主题/动效已声明。
- [ ] 14 可访问：角色/名称/状态/顺序/非颜色编码完整；`layers.accessibility.facts.ruleRefs` 可解析；焦点陷阱/返回已声明；L3 证据或 `NOT_RUN` 已记。
- [ ] 15 测量：测量键/revision/缓存/边界明确。
- [ ] 16 数据：身份/世代/串行/回执/陈旧回调明确；写动作绑定 `operationId`/owner。

## 附录 B：登记模板

```json
{
  "schemaVersion": "1.0",
  "modelVersion": "0.2",
  "pages": []
}
```

`pages[]` 每项的规范字段与16层键见 §9.1。新增页面时先补全 Brief 和每层类型化 facts；空 `pages` 只展示容器形状，不构成试点覆盖或合格登记。`source` 绑定当前页面文件 SHA-256，`registryRevisions` 绑定实际消费的各上游修订。

## 附录 C：例外模板

```json
{
  "id": "EX-000",
  "pageId": "",
  "invariantId": "",
  "reason": "",
  "owner": "",
  "compensatingControl": "",
  "sinceVersion": "",
  "expiresAtOrReviewTrigger": ""
}
```

## 附录 D：参考文件

### 页面与组件

- 书源管理页：`../../entry/src/main/ets/features/source/ui/SourceManagementPage.ets`
- 书籍目录页：`../../entry/src/main/ets/features/reading/ui/BookDirectoryPage.ets`
- 下载管理页：`../../entry/src/main/ets/features/downloads/ui/SharedDownloadPage.ets`
- 页面脚手架：`../../entry/src/main/ets/ui/layout/ReaderPageScaffold.ets`
- 返回栏：`../../entry/src/main/ets/ui/chrome/PageBackBar.ets`
- 页面状态：`../../entry/src/main/ets/ui/feedback/ReaderPageState.ets`
- 控件规格：`../../entry/src/main/ets/ui/controls/ReaderControlSpecs.ets`
- 操作事实：`../../entry/src/main/ets/app/ReaderOperationFacts.ts`

### 上游契约

- 页面框架：`ui-page-framework-20261014.md`
- 参数/几何/测量：`ui-parameter-contract-20261025.md`
- 表面角色：`ui-surface-role-contract-20261028.md`
- 导航/返回/保留：`interaction-wiring-20261019/navigation-comparison.md`
- 消息框架：`../message-ui/FRAMEWORK.md`
- 消息入口：`../../tools/message-entrypoints.json`
- 跨平台页面基线：`../ui-design/cross-platform-reference/PAGES_AND_STATES.md`
- 跨平台样式/动效：`../ui-design/cross-platform-reference/STYLE_AND_MOTION.md`

### 审计与配套方案

- 尺寸审计：`../issues/ui-dimensions-all-pages-20261101.md`
- 书源布局审计：`../issues/source-management-layout-20261101.md`
- 结构修复实施方案：`../issues/page-structure-fix-20261102.md`

## 独立设计来源与局部宿主补充

2026-11-13，全应用对比审计补充。层11的 `visual.facts.designContractRef` 解析到 `tools/contracts/design-authority.json`。登记局部批准范围、独立原稿、源码衍生画板、后继裁决和当前候选对比状态，引用文件保留SHA。当前四个页面族及21个宿主登记均保留原visual结果，局部批准不能升级成整页批准。整页PASS的comparison/native证据分别提供可解析path/SHA，证据JSON同时匹配pageId、sourcePath、主文件SHA、归一后的完整inputs及契约全部designInputs(path/SHA)。共享依赖、原稿或批准来源变化会使旧证据失效。

`check-register` 在现有显式调用时校验设计引用，拒绝缺独立批准范围或当前候选证据的整页visual PASS。`test-design-authority --case authority` 是本次具体正反回归，默认不执行。20个业务路由均在来源登记中有处置，当前缺失的整页批准来源继续列为OPEN_APPROVAL。

自定义临时表面需要分别登记自己的正文与覆盖区域。`overlay-assembly-contracts.json.localContentContracts` 指定file、owner及实际正文Builder，`check-overlay-assembly` 从这些正文Builder单独追踪。整个编辑器或cover采用position，不豁免其内部恢复提示的流内装配。当前登记TXT规则与TTS配置正文，准确回归 `test-overlay-assembly --case local-content` 包含真实宿主正例和插回Notice负例。检查范围仍是声明装配，原生实际几何、触摸与焦点各自取证。


## 阅读控制栏共享外壳与逐元素预算补充

2026-11-13，用户反馈从Home进入目录会改变快捷控制栏高度，随后要求全量检查控制栏元素。相同窗口、字体与安全区下，模块内容的自然最小高度用于内部流、滚动与输入可用性。共享外壳的宽度、Quick/Full端点、亮度条与共同锚点由共享布局事实决定。当前模块的测量回执继续使用当前实体、模块、世代和几何身份；切换内容不能通过替换外壳端点容纳自己的最小高度。窗口或字体改变时按新几何重新测量。

每个按钮分别声明绘制盒、响应载体及父级实际支付的空间。44vp触控目标允许包裹原36、32、30或21vp绘制，但新增载体需要沿原绘制中心和现有间距分配，实际字形增长继续进入预算。备用测量分支也需要支付载体。隐藏、被遮挡或已退出当前模块的原生闭包在最终派发前复核当前owner；语义隐去与视觉透明各自保留自己的职责。

逐元素登记覆盖共享元素及每个已挂载模块的Quick、Full、状态与临时层。代码审读、有限SDK属性/回调证据、原生绘制与用户接受分别记录。独立原稿与后继批准范围必须可追溯；源码衍生画板保留其比较用途。当前阅读控制栏的后继修复与实际执行证据见[全应用UI对比修复](ui-design-full-fix-20261113.md)。

### 控制栏几何字段的消费边界

2026-11-14，控制栏体系审计补充。每个动作同时描述独立的绘制盒、文字测量、父级槽位和实际响应矩形。`ReaderControlActorFrame` 提供当前矩形坐标，`paint`、`slot` 与 `response` 字段明确其角色。`ReaderControlResponseAllocation` 保存同一父空间内的这些矩形及 `requestedSize`、`complete` 与 `conflict`。原始图标、底色和卡片尺寸沿所属设计角色消费，文字宽高从当前实际内容及字体测量取得。行、卡片与相邻区域的坐标由自己的父预算推进。

响应区从该父级已经分配的空白空间支付，相邻动作之间按明确边界分配。同一动作可以包含较小的可见图形。空间不足时报告实际矩形和 `host` 或 `neighbor` 冲突，E2继续保留FAIL及后续条件。调整行形态、布局密度或业务动作时，需要可追溯的设计来源或对应裁决。默认原稿比例、文字增长和触控覆盖分别保留证据。

共享外壳优选值使用原始Quick330与Full736的参照关系，实际窗口、安全区、键盘、可用高度与当前文字共同决定可行端点。844vp窗口中，39vp状态栏与28vp手势区等真实约束可得到705vp完整高度。各端点同时记录优选值、实际约束与采用值，测量结果回到当前实体及几何身份。

模块页头使用自身角色配方。目录、书签、外观、设置的UI标题，搜索与自动翻页的Inter标题，MakeV17朗读的自然宽收起动作，以及替换规则的独立标题和“完成”动作分别解析。标题单行策略、字号增长和真实可用宽度共同测量。响应载体与抓手区域在同一dock坐标内分配；同一native抓手host的响应矩形可以更新，按下到释放期间保持该host身份。

### 控制栏测量请求与已提交呈现

`ReaderControlModuleFacts` 从真实业务owner提取几何所需事实，七个模块复用各自纯测量函数。`ReaderControlModuleProfileData` 保存与模块对应的完整结果，封闭模块标识与实际字段共同校验。测量准备只读取事实和字体信息，业务读取、媒体操作、焦点与编辑动作继续由原owner按真实生命周期触发。

导航准备请求绑定发起owner、目标模块、请求代次、相关事实和几何环境。已显示内容保持自己的已提交语义及完整profile；准备期间的Nav或Back可以替换或取消请求。结果采纳时核对这些身份，并共同提交模块session、profile、layout与receipt。普通模块导航沿现有零时长策略及唯一运动进度执行。

相同几何事实保持已采用的profile、key与native动作身份，选中、忙碌和数值显示按当前业务事实更新。真正改变文字或空间的事实触发新测量，旧请求回执遵守其失效条件。旧模块在仍为当前已提交页面期间保留原有操作准入，提交后由原owner检查退役闭包。输入准入、临时编辑scope和异步业务回调分别核对自己所属身份。

子组件Prop Watch可能在父组件render中执行，响应式呈现采纳须遵守当前ArkUI状态更新约束。同模块结构或长文案变化时，由同一已提交receipt保存必要的只读显示投影与对应profile，并共同交付下一份有效结果。业务状态仍归原owner，实际动作在最终派发处核对该owner。相同几何的显示更新复用几何对象与key，准备失败保留上一份完整呈现并允许现有Back处理。

导航从同步赋值调整为准备与提交协议时，沿真实入口审查全部调用方的后继副作用。依赖目标页面身份的读取在完整receipt和ready采用后由原业务owner启动，metadata与环境重采纳快径执行相同资格判断。一次入口的初始化复用既有实体、opening、module visit和业务代次去重，已开始的canonical读取计入同一入口。取消、后继请求、关闭和换书各有失效条件，busy解除沿实际采纳链恢复待启动读取。SDK回归走真实入口、bind、frame和提交方法，核对实际请求次数与当前回执。

包含目录、结果或规则集合的显示投影沿现有不可变快照传递。只读reader先捕获该事实时点的引用，再返回这份快照。SDK Prop递送的轻量tuple包含reader与几何标量，几何signature只消费实际测量输入；显示更新按原快照引用与必要标量去重。发布方实际存在原地修改时，按其变更边界固定必要字段。挂载后的Prop分批递送期间保留上一份完整的profile及显示投影，匹配的新tuple准备好后共同采用。首次挂载仍需完整有效tuple。

公共页头、导航、快捷动作和辅助操作的闭包捕获所属书籍、opening与已提交呈现身份。真正的Down先交给既有输入活动owner处理待导航请求，再进入原Runtime指针链。后续Move、Up与Cancel继续核对该Runtime及原手势owner。分页重试等业务动作另绑定原查询或原操作身份，消息外框沿消息框架展示该owner的事实。

ArkUI普通callback字段按长期receiver使用，可观察属性负责递送变化的操作上下文。`ReaderIconButton.actionScope`、`ReaderRecoveryAction.generation` 与 `ReaderPageState.actionGeneration` 等上下文由其原owner提供，当前native handler捕获本次值，在最终派发时核对。带expected参数的公共组件把该值交还长期receiver，调用方继续核对原实体、查询和操作。Builder与普通slot的捕获参数须核对实际SDK更新方式，变化的generation从当前owner的可观察事实取得。验证同时检查保留同一子组件后的当前动作可用性及旧handler退役，包含关闭再打开、同模块切tab、loading转失败和后继操作已开始等真实更新顺序。

模块交付的几何责任延伸到真实嵌套宿主。内部异步owner的loading、失败和query更新须沿自己的实际装配链审查，记录其是否改变祖先已支付的内容盒、列表起点或anchor。已有有效内容时，后台读取状态继续保留原列表几何。首次无内容状态在原内容区呈现，既有失败重试可沿所属内容Stack的局部覆盖槽提供，实际按钮命中区和周围穿透分别核验。父profile与key保持相同只证明父级事实，子级私有状态仍须有明确的几何处置和当前身份。

组合预算从实际子组件请求逐项回算。原生最小宽、paint、文字advance、间距、padding、border以及已有权重分配都须使用真实消费者的值。水平动作组默认需完整呈现的全部动作须在其实际可见viewport内得到支付，测量出的Scroll内容宽和profile字段只能作为中间输入。空间不足时按当前语义自然分行，行数与高度在同次profile中推进card和后继slot。横向滚动需有该组明确的适用依据与可发现性，默认遗漏必要动作保持FAIL。

高度需求向外取整到物理像素，可用容量向内取整，再按既有优选值和真实安全区选择端点。父盒伸展量从同一子项总和扣除间距、边框及额外动作区，所有组合顺序使用同一份实际消费者尺寸。原稿导出的微小小数补偿归入其原始绘制坐标，伸展公式根据当前分配重新求解。滚动资格同时核对真实Column组合高度与视口，完整组合回归保留原生边框修饰器、条件子项和实际Builder链。空Builder端口的结果登记为声明或方法证据。

Text或Row接入原生Button时，同步核对边框所属节点与真实内容盒。父Button拥有的边框及padding先从外盒扣除，显式子Text尺寸、加权文字列和文字增长测量均消费余下空间。沿实际border样式逐边计算，顶部单边框与四边框分别付款。条件边框的事实、标签、测量signature与已采纳绘制样式由同次呈现递送。默认绘制角色及其自然增长分别核对，原生包装前后的父子关系和边框迁移作为组件改造的准确回归输入。

原生属性组合遵循当前实际SDK的组件规则。当前Button声明要求显式borderRadius在border之后施加，原radius值及其条件分支通过准确发射序列保留。审查覆盖直接调用、attributeModifier和Styles展开后的同一原生节点，祖先或子节点的属性单独归属。全应用同型审计登记实际构造总数、解析闭包、逐点处置及旧顺序负例，具体SDK规则沿其适用组件执行。

表面的填充和描边绑定各自原始Surface的矩形、透明度与圆角。透明内容viewport、Quick表面、Full表面各有明确绘制owner，按原actor轨迹合成。已有不透明滚动内容需要上方描边时，纯paint节点与所属Surface严格共享矩形和透明度，保持原指针所有权。内容组件已经拥有外框的变体登记其归属，公共外壳仅绘制自己负责的表面。准确回归同时核对多进度点的实际actor坐标、alpha与绘制顺序。

准确回归同时装配producer、profile和实际子Builder，核对所有必要动作的可见盒、响应盒和所属父盒。例行端点还须涵盖已有内容加loading、失败重试和新query的中间顺序。源字段、单个Builder和最终settled帧各自保留准确范围，实际ArkTS工程类型检查与原生逐帧采样分别记录。

业务快照的原始引用及作用域由原publication或业务owner提供。SDK State/Prop生成的显示代理参与响应式绘制，原操作身份通过owner提供的引用或稳定scope核对。身份测试须启用生产实际使用的State/Prop装饰器并走真实接受方法，核对原快照、显示代理、当前busy与查询变化的完整链。

验收须观察初次挂载、导航准备中间态、采纳帧、同几何业务更新、真实几何变化、旧请求晚到和Back取消。测试核对中间态的实际enabled、opacity与已采用布局。默认1×整组位置和层级直接与冻结独立原稿比较，字号与窗口矩阵核对增长及实际冲突。仅在frame队列耗尽后检查最终key的结果保留其有限范围。Home滚动能力变化保持同一个Scroll宿主及内容实例。


### 导航取消与真实挂载入口

准备请求的取消同时核对存储对象和当前有效身份。活跃请求的Back可以消费本次返回并退休请求代次。已因关闭、隐藏、opening或owner变化失活的对象完成清理后，同次Back继续当前页面的正常返回策略。所有取消调用方声明是否使用消费结果，普通清理继续退休旧测量回执。

交互回归从真实build装配链到最终接收端核对可达性。直接调用私有Builder可以证明该方法的有限行为，当前挂载入口需要提供build或既有BuilderParam的实际接线。保留的未挂载Builder、只读sourceOnly预览和动态未解析入口分别记录，组件库存与当前UI入口的数量保留各自事实。


## 2026-11-18 正常页面设备证据

整页及模块 UI 验收从应用正常入口进入，保留实际父页面、公共页头页脚、原生弹层及操作链。测试时打开应用「设置 → 通用设置 → 开发者模式 → 显示组件边界」。复用同一 `ReaderWindowCoordinator` 的窗口、密度、安全区和键盘回执，以及 `ReaderLayoutDebugOverlay` 的 `READER_DEVELOPER_LAYOUT` 输出。节点原始与可见边界从当前正常页面的原生树取得。画布输出只用于定位组件盒，不能替代真实屏幕裁切或实际命中判断。

每项在同一候选、同一应用窗口和同一稳定业务状态下绑定完整实屏、布局树、当前开发者参数及本场景必要回执。测量就绪、有效可见区域和预期场景必须吻合。任一必需参数缺失、过期、异常或轮廓被遮挡、实际文字裁切时判定不通过。未运行保留 `NOT_RUN`。隔离组件页、模拟窗口条带、内存替代回执及局部截图的原生验收全部撤销，不能用于整页或交互验收。 [验收撤销与当前证据](../../.reader-artifacts/app-ui-framework-audit-20261114/pass-screen-reaudit-20261118.md)

显式运行现有登记检查时，页面层或规则的 `PASS` 引用 `kind=device`、`symbol=normal-page` 的同场景记录。记录注明 `pageId`、`routeContractRef` 和实际覆盖的 `claims`，用路径和 SHA-256 绑定签名清单、保数据部署回执、原始采集会话和实屏／布局树。每帧注明日志行、预期窗口／密度／生效字号／IME 状态及正常页锚点。平台字号与实际生效字号确有不同的场景应明确登记两项期望。登记检查读取这些现有证据，使用真实页面上的开发者模式及现有设备采集入口。通过绑定检查后，仍需按场景核对完整画面与实际动作结果。 [现有登记检查](../../tools/page-structure/check-register.mjs)
