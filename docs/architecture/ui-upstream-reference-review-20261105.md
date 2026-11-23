# UI 架构开源应用对照（2026-11-05）

起因：首版目标方案主要来自 Reader 源码和原则推导，缺少真实开源应用对照。此次补充源码研究，区分已有实现依据、可复用候选、Reader 必要适配和未验证判断。本文不是新增实施待办，不将他人的架构存在等同于适合直接替换 Reader。

优化版说明：以下固定提交、许可和外部源码观察沿用原研究，本轮没有重新联网或构建这些应用。Reader 的当前决定见[总方案 §0](ui-target-architecture-20261105.md#0-优化后的决定与首批边界)：统一几何合同和每实例唯一 owner，保留必要的标准页/领域内容适配；本轮保留 ReaderRoute/保留阅读层，不迁移 NavPathStack；设置先形成完整候选，书架搜索与阅读/漫画先做有界合同可行性核对。外部项目采用某个 Scaffold 或导航库，不决定 Reader 必须采用同样的文件粒度、万能壳或导航替换顺序。

## 研究范围与固定输入

通过 GitHub 主仓元数据、固定提交的目录/模块依赖、实际组件及消费者、状态/导航和许可证核对。没有运行这些应用，没有验证其完整构建、设备体验、性能或商业成熟度；仓库 stars、README 功能列表和更新时间不作为架构正确性证据。

| 项目 | 平台与固定提交 | 根许可证与限制 |
| --- | --- | --- |
| [京墨](https://github.com/hefengbao/jingmo-for-HarmonyOS) | 鸿蒙 ArkTS/ArkUI；[`a208f3fd`](https://github.com/hefengbao/jingmo-for-HarmonyOS/commit/a208f3fdc95c0914749072e811301b9dfd6678d6)，v1.2.1 | 根 MIT；部分模块清单标 Apache-2.0，具体复用需逐文件核对 |
| [轻页](https://github.com/wip3l/qingye-reader) | 鸿蒙原生阅读器；[`2e10cf13`](https://github.com/wip3l/qingye-reader/commit/2e10cf13bb09f68e3c0c0c5b052d64d09d0eaee9) | GPL-3.0 + 指定 AI 引擎链接例外；AI 依赖未公开，不作为独立可构建完整替代方案 |
| [轻隐](https://github.com/agiledesign-ai/qingyin-browser) | 鸿蒙原生浏览器；[`cc07836e`](https://github.com/agiledesign-ai/qingyin-browser/commit/cc07836e050409128863a3c9109266027d367b84) | Apache-2.0；仅作为局部会话设计辅助参考 |
| [Now in Android](https://github.com/android/nowinandroid) | Google 官方完整示例应用，Kotlin/Compose；[`2982e63c`](https://github.com/android/nowinandroid/commit/2982e63cb691ad49cd009aab43dc206fee6699c2) | Apache-2.0；平台 UI 不直接移植为 ArkUI |
| [Read You](https://github.com/ReadYouApp/ReadYou) | Android RSS 阅读应用；[`d2b979cc`](https://github.com/ReadYouApp/ReadYou/commit/d2b979ccad9a3e54b9499929a9dc2824578b0fd9)，0.16.2 | GPLv3；原仓 Ashinch/ReadYou 已迁移，应用源码仅作设计研究 |
| [Readest](https://github.com/readest/readest) | React/Tauri 等桌面、移动/Web 阅读应用；[`c4673077`](https://github.com/readest/readest/commit/c46730772847d5d551e73aa1b2adebff339f634c)，0.12.16 | AGPLv3；应用源码仅作设计研究，独立上游库另行核对 |

鸿蒙三仓已核到 `.ets`、ArkUI 组件和原生平台调用，非 Android 兼容版本。以上提交是本次观察快照，不声称永远最新，也不等同于最新发布包。

## 1. 京墨：模块分层与原生导航的直接参考

实际结构为 `products/default` 产品入口，`features/home/settings/bookmark/classicalliterature/...` 业务模块，`commons/constants/data/utils/uicomponents` 公共能力。业务模块通过包清单声明依赖，不只是目录示意。[模块依赖源码](https://github.com/hefengbao/jingmo-for-HarmonyOS/blob/a208f3fdc95c0914749072e811301b9dfd6678d6/features/classicalliterature/classicpoem/oh-package.json5)

首页使用 `@ComponentV2`、`NavPathStack` 和 `Navigation`；子页以 `NavDestination` 承接，使用原生栈跳转。[HomePage](https://github.com/hefengbao/jingmo-for-HarmonyOS/blob/a208f3fdc95c0914749072e811301b9dfd6678d6/features/home/src/main/ets/pages/HomePage.ets#L11)、[SearchPage](https://github.com/hefengbao/jingmo-for-HarmonyOS/blob/a208f3fdc95c0914749072e811301b9dfd6678d6/features/classicalliterature/classicpoem/src/main/ets/pages/SearchPage.ets#L10)

采用价值：产品装配—业务功能—公共基础的分工有真实鸿蒙应用依据；新增通用导航能力应先核对原生，不能自建路由/Scene 引擎。Reader 本轮迁出现有有限导航接线而保留承载，不据此声称原生导航不支持其生命周期。

限制：不能将该仓视为完整单向流和复杂生命周期模板。其诗词 ViewModel 较薄、导出单例，部分错误转为 undefined；搜索仍在页面执行查询和更新结果。它没有为 Reader 的未决事务、长任务和隐藏阅读会话提供充分覆盖证据。[实际 ViewModel](https://github.com/hefengbao/jingmo-for-HarmonyOS/blob/a208f3fdc95c0914749072e811301b9dfd6678d6/features/classicalliterature/classicpoem/src/main/ets/viewmodel/ClassicPoemViewModel.ets)

## 2. 轻页：阅读器页面骨架及任务/弹层分工

`PageScaffold` 实际统一标题、返回、尾部动作、内容、底色和系统留白，并支持内置滚动/外部列表；`BookImport` 有实际消费。[PageScaffold](https://github.com/wip3l/qingye-reader/blob/2e10cf13bb09f68e3c0c0c5b052d64d09d0eaee9/entry/src/main/ets/components/common/PageScaffold.ets)、[BookImport](https://github.com/wip3l/qingye-reader/blob/2e10cf13bb09f68e3c0c0c5b052d64d09d0eaee9/entry/src/main/ets/pages/BookImport.ets)

缓存任务 Controller 持有任务和取消，缓存弹层在出现时订阅、消失时退订并作废加载序号，关闭展示不停止任务。这为 Reader 现有的操作/展示生命周期分离提供了具体对照。[任务 Controller](https://github.com/wip3l/qingye-reader/blob/2e10cf13bb09f68e3c0c0c5b052d64d09d0eaee9/entry/src/main/ets/core/reader/ReaderFullTextCacheController.ets#L15)、[弹层生命周期](https://github.com/wip3l/qingye-reader/blob/2e10cf13bb09f68e3c0c0c5b052d64d09d0eaee9/entry/src/main/ets/components/reader/ReaderCacheDialogContent.ets#L43)

限制：该应用将大量业务/数据库放在 ArkTS，不能照搬而绕过 Reader Rust Core。骨架默认 `router.back()` 也不能直接覆盖 Reader 的保存退出和嵌套返回规则。主模块依赖私有 AI 引擎，公开源码不等于已经具备经验证的独立主应用构建输入；本次没有尝试构建。[依赖](https://github.com/wip3l/qingye-reader/blob/2e10cf13bb09f68e3c0c0c5b052d64d09d0eaee9/entry/oh-package.json5)、[LICENSE](https://github.com/wip3l/qingye-reader/blob/2e10cf13bb09f68e3c0c0c5b052d64d09d0eaee9/LICENSE)

## 3. Now in Android：主要结构与公共组件参考

其 feature 按 `api/impl` 分离导航 key 与页面/ViewModel；`core/designsystem` 承载基础控件、主题和图标，`core/ui` 放绑定新闻模型的组合组件。此处特别值得 Reader 采用的是基础组件与领域组件的区别，不是复制全部 Gradle 模块。[模块说明](https://github.com/android/nowinandroid/blob/2982e63cb691ad49cd009aab43dc206fee6699c2/docs/ModularizationLearningJourney.md)、[实际领域卡片](https://github.com/android/nowinandroid/blob/2982e63cb691ad49cd009aab43dc206fee6699c2/core/ui/src/main/kotlin/com/google/samples/apps/nowinandroid/core/ui/NewsResourceCard.kt#L69)

`NiaTopAppBar` 直接组合 Material3 的完整顶栏和 IconButton，只提供应用所需的参数和回调，没有另建基础按钮机制。[实际顶栏](https://github.com/android/nowinandroid/blob/2982e63cb691ad49cd009aab43dc206fee6699c2/core/designsystem/src/main/kotlin/com/google/samples/apps/nowinandroid/core/designsystem/component/TopAppBar.kt#L41)

页面从 ViewModel 收集状态，向内容层传递具名回调。单向流不等于每次点击都需要全局 reducer。[ForYouScreen](https://github.com/android/nowinandroid/blob/2982e63cb691ad49cd009aab43dc206fee6699c2/feature/foryou/impl/src/main/kotlin/com/google/samples/apps/nowinandroid/feature/foryou/impl/ForYouScreen.kt#L108)、[ForYouViewModel](https://github.com/android/nowinandroid/blob/2982e63cb691ad49cd009aab43dc206fee6699c2/feature/foryou/impl/src/main/kotlin/com/google/samples/apps/nowinandroid/feature/foryou/impl/ForYouViewModel.kt#L90)

所选提交已使用 Navigation 3、官方 SceneStrategy 和状态/ViewModel 装饰器；不沿用仓内较旧描述把它写成 Nav2。它上面的 Navigator 是有限应用策略，不是完整自制导航引擎。[生产导航](https://github.com/android/nowinandroid/blob/2982e63cb691ad49cd009aab43dc206fee6699c2/app/src/main/kotlin/com/google/samples/apps/nowinandroid/ui/NiaApp.kt#L258)、[Navigator](https://github.com/android/nowinandroid/blob/2982e63cb691ad49cd009aab43dc206fee6699c2/core/navigation/src/main/kotlin/com/google/samples/apps/nowinandroid/core/navigation/Navigator.kt#L26)

采用价值：基础设计系统/领域 UI 分层、实际原生控件薄适配、状态/事件分工，以及独立组件目录预览。

限制：这是官方完整示例应用，不是对 Reader 数据保护场景的验收。其 Room、Repository、Flow、Compose 和 Navigation 3 实现均不直接搬到 ArkTS；Rust Core 已有事实源不重建。AndroidX 的 SceneStrategy 不能证明 Reader 需要自己实现一个鸿蒙 Scene 框架。[Apache-2.0](https://github.com/android/nowinandroid/blob/2982e63cb691ad49cd009aab43dc206fee6699c2/LICENSE)

## 4. Read You：真实阅读应用中的原生复用与宽屏组合

单 app 内按页面、基础组件、主题组织，阅读/订阅有各自 ViewModel 和 StateFlow。导航使用原生库，列表与正文通过 Material3 自适应页面组合。[应用导航](https://github.com/ReadYouApp/ReadYou/blob/d2b979ccad9a3e54b9499929a9dc2824578b0fd9/app/src/main/java/me/ash/reader/ui/page/nav3/AppEntry.kt#L65)、[阅读分栏](https://github.com/ReadYouApp/ReadYou/blob/d2b979ccad9a3e54b9499929a9dc2824578b0fd9/app/src/main/java/me/ash/reader/ui/page/adaptive/ArticleListReadingPage.kt#L120)

图标动作包装平台 IconButton，主题根注入颜色、字型、形状和动效，正文渲染差异留在专用内容适配中。[FeedbackIconButton](https://github.com/ReadYouApp/ReadYou/blob/d2b979ccad9a3e54b9499929a9dc2824578b0fd9/app/src/main/java/me/ash/reader/ui/component/base/FeedbackIconButton.kt#L24)、[Theme](https://github.com/ReadYouApp/ReadYou/blob/d2b979ccad9a3e54b9499929a9dc2824578b0fd9/app/src/main/java/me/ash/reader/ui/theme/Theme.kt#L69)、[阅读内容适配](https://github.com/ReadYouApp/ReadYou/blob/d2b979ccad9a3e54b9499929a9dc2824578b0fd9/app/src/main/java/me/ash/reader/ui/page/home/reading/Content.kt#L79)

限制：仓库仍在迁移，`RYScaffold` 已标弃用并要求改用 Material3 Scaffold，却仍有消费者；部分工具栏避让使用固定 spacer。该事实说明不应永远保留平台能力的重复包装。GPL 应用代码及其具体文件的上游声明保持独立，不进入 Reader。[RYScaffold](https://github.com/ReadYouApp/ReadYou/blob/d2b979ccad9a3e54b9499929a9dc2824578b0fd9/app/src/main/java/me/ash/reader/ui/component/base/RYScaffold.kt#L22)、[LICENSE](https://github.com/ReadYouApp/ReadYou/blob/d2b979ccad9a3e54b9499929a9dc2824578b0fd9/LICENSE)

## 5. Readest：语义行、主题域和阅读引擎边界

设置页将行、开关行、导航行、分组卡等拆为通用语义组件，ControlPanel 连续消费同一家族；导航行使用真实 button，选择器使用受控 value/options 及 radio/checked 语义。[SettingsRow](https://github.com/readest/readest/blob/c46730772847d5d551e73aa1b2adebff339f634c/apps/readest-app/src/components/settings/primitives/SettingsRow.tsx)、[SettingsSwitchRow](https://github.com/readest/readest/blob/c46730772847d5d551e73aa1b2adebff339f634c/apps/readest-app/src/components/settings/primitives/SettingsSwitchRow.tsx)、[NavigationRow](https://github.com/readest/readest/blob/c46730772847d5d551e73aa1b2adebff339f634c/apps/readest-app/src/components/settings/primitives/NavigationRow.tsx#L40)、[实际消费者](https://github.com/readest/readest/blob/c46730772847d5d551e73aa1b2adebff339f634c/apps/readest-app/src/components/settings/ControlPanel.tsx#L530)、[SegmentedControl](https://github.com/readest/readest/blob/c46730772847d5d551e73aa1b2adebff339f634c/apps/readest-app/src/components/SegmentedControl.tsx#L53)

主题区分 library/reader 作用域；BookCell 组合头部、阅读器与底部，内容避让集中计算；Dialog 统一处理部分焦点、键盘和关闭生命周期。这些分别对应 Reader 的主题域、专用阅读承载及公共表面合同。[主题](https://github.com/readest/readest/blob/c46730772847d5d551e73aa1b2adebff339f634c/apps/readest-app/src/styles/themes.ts#L12)、[BooksGrid](https://github.com/readest/readest/blob/c46730772847d5d551e73aa1b2adebff339f634c/apps/readest-app/src/app/reader/components/BooksGrid.tsx#L222)、[避让计算](https://github.com/readest/readest/blob/c46730772847d5d551e73aa1b2adebff339f634c/apps/readest-app/src/app/reader/hooks/useContentInsets.ts)、[Dialog](https://github.com/readest/readest/blob/c46730772847d5d551e73aa1b2adebff339f634c/apps/readest-app/src/components/Dialog.tsx)

限制：其 DESIGN 明确记录系统化仍在进行，旧/新按钮同时存在；不能作为永久双实现或全部 UI 已统一的范本。React/Tauri 组件无法直接在 ArkUI 原生界面运行，AGPL 应用源码仅作为架构研究。[DESIGN](https://github.com/readest/readest/blob/c46730772847d5d551e73aa1b2adebff339f634c/apps/readest-app/DESIGN.md#L7)、[LICENSE](https://github.com/readest/readest/blob/c46730772847d5d551e73aa1b2adebff339f634c/LICENSE)

其独立 foliate-js 上游固定在 `c14f30c83003ca05b9d2fd95148eff5bda9605df`，为 MIT；它使用 DOM/HTMLElement 等 Web 能力，不能因许可不同就认为可直接替换 ArkTS/Rust 渲染与位置合同。若未来评估 Web 阅读路径，须单独验证格式、位置、资源安全与数据保护，不借本次 UI 架构工作换引擎。[独立库 LICENSE](https://github.com/readest/foliate-js/blob/c14f30c83003ca05b9d2fd95148eff5bda9605df/LICENSE)、[view.js](https://github.com/readest/foliate-js/blob/c14f30c83003ca05b9d2fd95148eff5bda9605df/view.js#L243)

## 6. 轻隐：会话状态与平台对象分离的辅助参考

`TabSessionManager` 根据会话和事件输出新状态、runtime transition 与恢复计划；`WebRuntimePool` 给出状态和挂载动作，UI 创建/销毁真实 Web 对象，Index 实际消费结果。可对照 Reader 的保留阅读会话和可见界面分工。[TabSessionManager](https://github.com/agiledesign-ai/qingyin-browser/blob/cc07836e050409128863a3c9109266027d367b84/entry/src/main/ets/features/tabs/TabSessionManager.ets#L17)、[WebRuntimePool](https://github.com/agiledesign-ai/qingyin-browser/blob/cc07836e050409128863a3c9109266027d367b84/entry/src/main/ets/features/tabs/WebRuntimePool.ets#L21)、[消费者](https://github.com/agiledesign-ai/qingyin-browser/blob/cc07836e050409128863a3c9109266027d367b84/entry/src/main/ets/pages/Index.ets#L1608)

限制：根 Index 仍大且有很多 UI 布尔状态，局部纯状态模块不能证明全仓理想分层；它的 NavigationCoordinator 主要处理浏览地址，不误当成应用路由架构。[仓库与许可证](https://github.com/agiledesign-ai/qingyin-browser/tree/cc07836e050409128863a3c9109266027d367b84)

## 7. 对 Reader 提案的实际修订

| 决策 | 开源实证及 Reader 处理 |
| --- | --- |
| 主结构采用产品装配—业务功能—公共基础 | 京墨有实际鸿蒙模块依赖，Now in Android 有更清楚的 app/feature/designsystem/domain UI 分离；取职责，构建模块按需要拆 |
| 单屏 MVVM/单向流，不引入全局 MVI | Now in Android 和 Read You 的实际状态收集/具名回调支持；继续消费 Reader 原业务 owner |
| 原生能力为基础，Reader 薄适配 | NiaTopAppBar/Read You 控件封装给出实际范例；先核对 ArkUI 完整能力，再补必要 Reader 外观/平台合同。Reader 统一输入/结果和 owner，不凭文件数强制合并，也不让有限适配变成另一套基础引擎 |
| Scene 只是展示归属术语 | 没有证据需要额外自建通用 Scene/路由/生命周期引擎；本轮沿用 ReaderRoute/保留层，由 app/navigation 唯一接线，保存退出、实体身份、显式退出与隐藏继续按原合同 |
| 公共基础与领域组件分开 | NIA designsystem/core-ui、Readest 语义行与 reader chrome 给出实际边界；漫画模型/下载任务不再放入通用基础控件层 |
| 统一主题和页面 chrome，内容引擎独立 | Read You/Readest 提供实现对照；Reader 保留 App/Reader 主题域、原几何和阅读/漫画引擎 |
| 任务存活与弹层订阅分开 | 轻页有实际实现；Reader 沿用已有操作 owner，不按其 ArkTS 数据库结构重写 Core |
| 增加公共组件的集中预览 | 可参考 NIA catalog，优先扩展既有开发预览；展示无业务副作用的必要状态，不是新的 UI 配置引擎或全量门禁 |

没有任何一个已研究仓库被证明能完整替代 Reader 的原生 UI、Rust Core 事实源和保留会话。当前产出是有固定源码支持的架构候选；仍需用 Reader 的普通设置、书架搜索和阅读/漫画纵切核对适配。

三种纵切不要求同批迁移。设置首先形成真实候选；复杂路径提前核对合同可表达性，再按旅程完成其真实消费者、交互与旧路径退出。Read You 弃用 Scaffold 仍有消费者、Readest 新旧按钮共存，应作为债务收口反例，而非 Reader 长期保留双实现的依据。原方案已有消费者/退役条件；优化补的是精确依赖基线、实际参数/类型/传播检查与同批退出规则，检查接入属于未来 UI-01，本轮未实现。

## 8. 直接复用的准入

本次 GPL/AGPL 应用仅用于语义和架构观察，没有选择复制其实现进入 Reader；MIT/Apache-2.0 项目中的具体能力可进入复用候选，但仍须核对文件来源、依赖许可、版本、目标平台和实际完整覆盖。许可标签不等于某段代码已经符合项目采用条件。按本工作区现有要求，相同能力能由原生或已引入上游完整提供时，直接使用，不再开发另一套通用算法。

此处的产品架构参考不自动授权引入整个库、换阅读引擎、迁移用户数据、开放关闭模块或增加默认检查。后续采用决定与代码、本地验证、产物和设备验收分开记录。

## 9. 平台能力对照补充

平台采用以项目 API 23 的实际导出为准。本机 OpenHarmony SDK 23 的声明包版本为 `6.1.0.32`；早期读取的 DevEco SDK `26.0.0.105` 及其 `@since` 仅作候选参考，不能替代目标 SDK 的实际能力。24 或 26 才引入的字段不纳入，OpenHarmony 固定提交 `f41b9345badd47c7ab0c263344cd7f4b5a549afb` 继续作为对照来源。以下只记录声明能力及采用约束，不证明实际节点布局或事件行为。

| 平台能力 | API 23 可用输入 | Reader 路径的采用边界 |
| --- | --- | --- |
| `ComposeTitleBar` | `item/title/subtitle/menuItems` 自 API 10，无障碍文本自 18；左项与菜单项的声明类型均含 `action`。声明本身不能证明左项回调一定执行或一定不执行；不依赖 API26 的标题栏 V2。 | 普通首页标题和返回栏分用途裁定。`PageBackBar` 必须能把左项动作明确转交当前返回/保存退出 owner，另核对字体、焦点、尾槽、veil 与形变；不能以缺少同名 `onBack` 参数预先否定原生接法。完整覆盖的用途采用，已证明不足的用途只补有限语义与几何适配。[华为 ComposeTitleBar](https://developer.huawei.com/consumer/en/doc/harmonyos-references-V5/ohos-arkui-advanced-composetitlebar-V5/) |
| `ComposeListItem` | API 10 提供内容项和 arrow/icon/button/switch/checkbox/radio 等操作项。`OperateCheck` 有 `isCheck/onChange`，18 加无障碍描述；不依赖 API26 的列表项 V2。 | 设置导航行保持唯一整行动作，布尔行转交同一受控意图。核对公开组合能否覆盖字体、独立禁用/忙碌、行内点击传播与辅助语义；外层通用属性不能直接证明内部控件具备对应行为。完整覆盖的行型采用，具体不足才保留 `ReaderFormRow` 与原生控件的有限组合。[华为 ComposeListItem](https://developer.huawei.com/consumer/en/doc/harmonyos-references/ohos-arkui-advanced-composelistitem/) |
| `SegmentButton` 与 V2 | V1 自 11，`selectedIndexes` 为 `@Link`，`maxFontScale` 自 14。API23声明也包含自18的V2单选下标、回调、`itemMinHeight` 与单项 `enabled/textModifier`；`TextModifier` 能表达字体及通用属性。`enableStateAnimation` 自24，不纳入。 | V1限制不能推广到V2。App主题需核对modifier边框是否作用于整项所需边界，不能从缺少 `selectedBorder` 字段就判定无法覆盖。书架需核对单选未选背景；不为借用多选外观而改掉固定单选语义。稳定ID、原owner接受值、命中与辅助语义完整覆盖则采用，差异只保留于该用途的必要适配。[华为 SegmentButtonV2](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ohos-arkui-advanced-segmentbuttonv2/) |
| `PromptAction` Toast | `UIContext.getPromptAction().showToast` 自 10，`openToast/closeToast` 自 18，`DEFAULT/TOP_MOST` 自 11。 | 原生选项可指定文本、时长、偏移和层级，缺独立标题、语义图标及 Reader 字体。统一呈现与前景窗口验收见 [消息框架](../message-ui/FRAMEWORK.md#系统-toast-的适用边界)。[华为 PromptAction](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uicontext-promptaction/) |

以上为平台声明与具名消费路径的适用性判断。设备上的焦点、命中、字号与原生覆盖层仍按真实旅程验收。采用规则统一见 [总方案 §15](ui-target-architecture-20261105.md#15-实施设计总表与复用裁定)。
