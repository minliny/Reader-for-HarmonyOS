# 主导航与跨页面审计修复（2026-10-26）

输入：用户粘贴的 9 项 P1/P2 与 4 项 P3 清单。基线 HEAD `3b297fdc7e724cf655eca3bac2a8efeda2001c56`，当前工作树已有大量未提交修改；本轮基于现场修改，不覆盖既有 WIP。此前构建不能作为本轮结果。

## 来源、消费者与唯一责任方

| 问题 | 参数/事实来源 | 消费者 | 修复责任方 |
| --- | --- | --- | --- |
| P1-1 状态页 rail 遮挡 | 主导航模式与内容 frame | 书架加载/失败/空态 | MainNavigationSpec + 页面内容 geometry |
| P1-2 模式/内容宽度分叉 | 主页面宿主实测 viewport | 主壳、书架、发现、RSS、设置 | 主壳发布一次，所有主页面消费同一份 |
| P1-3 可访问性 | 原业务动作及选中/忙态 | 卡片、筛选、关闭、搜索、设置行、多选 | 现有控件/共享语义修饰器，不改变业务 owner |
| P2-4 RSS 双避让 | contentLeadingRail | RSS 内容 | page geometry 唯一让位，删除额外 Blank |
| P2-5 默认迁移 | Preferences 中是否保存导航选择 | Settings + AppStorage | SettingsGateway 默认底栏，保留显式选择 |
| P2-6 固定行高 | 内容自然高度及字体 | 书源工具、规则、同步历史 | minHeight + 内容排版 |
| P2-7 参数/主题 | 共享 tokens、Reader-UI/theme/registry.json | 公共卡片/页面 | 语义 token 与受控主题源 |
| P2-8 网格高度 | 真实字级/进度行/字体比例 | 书架、多选 | BookshelfGridSpec |
| P2-9 设置重复 | SettingsSnapshot / GeneralSettingsKey | Page、Orchestrator、Index | SettingsGateway 单一契约 |
| P3 窄书源行 | 内容可用宽度 | SourceManagementPage | 窄宽时操作换行 |
| P3 死筛选 | 无入口的 readingFilter | BookshelfPage | 删除无效本地状态分支 |
| P3 空态图标 | actionsEnabled=false | BookshelfSectionHeader | 不渲染无效动作 |
| P3 隐藏页入口 | 真实已有业务能力 | Discover、Settings | 接入既有 owner 或移除虚假动作；保持产品范围关闭 |

## 验证计划

先执行代码修复；随后记录准确检查入口、嵌套调用、保护风险和必要性，再执行。只验证本次导航几何、设置迁移/持久化、共享网格与编译；不触发全量，不占用设备，不清数据。源码、本地回归、编译、产物、设备与用户验收分别记账。

当前：修复中；本轮测试/构建/设备验收均未执行。

## 本次准确验证入口与依据

- `node tools/test-main-navigation-audit.mjs --case viewport-rail,settings-migration,grid-height,action-semantics`：仅 SDK TypeScript 转译实际生产模块，在边界注入 Preferences/AppStorage/window facts；不执行其他测试、构建或设备操作。分别保护 599/600 与宿主/窗口不等宽、短窗口与 1/1.5/2 字体比例、设置默认值/显式偏好/未知 ACK、含进度网格自然行高及 disabled/selected 可访问性事实。本次改变对应逻辑，必须验证。
- 主题迁移值校对：对照本轮改前备份与受控迁移表，逐项核对 282 个旧角色在 day/night 的值与新角色相同，并检查活动 ArkTS 消费者没有旧角色。生成入口 `node tools/generate-theme-registry.mjs` 只写两个主题投影与原有 selection 投影；`--check` 只比对生成字节，不含业务测试。必要性：本轮修改主题角色名称和消费者。
- `node scripts/hap-pipeline.mjs build --class iteration`（contracts 默认 none）：执行输入快照、Native/SDK 字节配套、私有指定签名准入、隔离 OHPM 解析、ArkTS 编译/打包和包内资源/签名检查。必要性：跨组件 ArkTS、导入与新共享修饰器必须通过真实编译；不自动附带全量回归。已有 dirty Native/Core 输入按 pipeline 当前事实判断，不能拿旧包代替。

查询到的通用设置旧检查仍硬编码五个字段和五次 put，缺少已新增的 wideNavigationRail；本轮不把它作为六字段迁移的有效验收。新增精确用例直接加载当前 Gateway 全模块，不用旧 fixture 推导通过。

### 源码复核发现并纠正的细节

`ReaderPageGeometry.contentLeadingRail` 原先只从宽度扣除 rail，却没有把返回 frame 的 left 转换回完整宿主坐标；RSS 外层 Blank 实际承担了部分坐标平移，因此不能只删 Blank 就声称修好。当前将坐标转换放回 geometry 唯一 owner，RSS 内容和头部均删除外部 Blank，Discover/Settings 同步得到完整宿主坐标。定向回归追加 600/760/960 下 `left + width + right = hostWidth`、左侧最小让位和关闭 rail 反例。

构建尝试 `1793010213898-c33524e9-efd2-4f2f-a3f5-3eb4ab8be00e`：FAIL，未进入编译。共享构建租约由活跃 PID 69398 的 isolated Core x86_64 Native 构建持有。已确认进程仍活跃，未删除锁、未终止对方任务。

补充选择 `tools/test-main-navigation-audit.mjs --case sdk-navigation`：使用现有 `reader-control-builder-probe` 对真实 MainTabBar 的 bottomBar/verticalRail/tabItem 做 SDK lowering 并执行保留 observer，核对两种模式的按钮、选中/焦点以及字号变化后的 rail 高度与 padding。只读 SDK、内存记录，不启动 Hvigor/Native/HDC、不占共享构建锁；其输出不能证明原生像素或实际读屏操作。

SDK 导航检查首次尝试暴露测试装载器仍假设 token 没有 re-export，随后又暴露其既有依赖白名单漏掉 HeaderMetrics。已将两个 token 装载器绑定实际 ReaderLayoutTokens，并只补白名单中的实际 HeaderMetrics/LayoutTokens 依赖；未删断言、未替换生产实现。修复后 sdk-navigation PASS。

构建尝试 `1793010473697-9be43a3b-b5ed-4d46-b531-25274a258cfa`：进入真实 ArkTS 编译后 FAIL。新可访问性修饰器使用 TypeScript 构造参数属性，ArkTS 禁止此语法（4 个字段诊断）。已改为显式字段与构造赋值，重验对应 action-semantics 后重新构建。这个失败证明普通 TS 转译不等于 ArkTS 类型检查通过。

发现书籍回调额外复核：@Prop 可复制对象，不能以对象引用相等判定归属；改用当前展示 owner 中 sourceId/bookId 查询，并使用当前记录生成详情 seed，保留原展示代次准入与返回发现的路由。

补充选择 `tools/test-main-navigation-audit.mjs --case discover-selection`：从当前 Index AST 提取真实发现点击回调和详情返回方法，分别验证 @Prop 复制对象、当前 owner 元数据优先、已退役展示/移除结果拒绝，以及 discover/search/bookshelf 返回目标。只执行实际回调和路由方法，不发网络请求；本次新增发现结果点击路径，需确认稳定身份和返回链。

## 最终结果

清单 9 项 P1/P2 与 4 项 P3 均已完成对应源码修复。具体行为：

- 主壳发布完整宿主测量，书架/空态/状态页/发现/RSS/设置以及底栏宽度统一消费。rail 高度包含图标、随字号变化的标签、间距与内边距；短窗口继续回退 bottom。
- 状态页内容使用右侧可用 frame；公共 geometry 输出完整宿主坐标；RSS 不再用 Blank 手工二次平移。
- 书籍卡片、多选、筛选 chip/清除/收起、搜索、对话框关闭、设置点击行补统一 role/label/focus/selected/enabled。隐藏书架投影隐藏读屏子树；设置忙态仍由原业务 owner 提供。
- 未保存导航字段的 Preferences 默认为底栏；显式 true/false 保留。Snapshot 与 Key 由 Gateway 唯一定义，Index/Page 默认工厂共用。
- 指定书源工具、规则和同步历史行改为最小高度；书架和多选的同一字级、间距、进度行和字号比例由 BookshelfGridSpec 统一计算。
- 公共卡片圆角收敛到现有刻度；屏边距迁入纯 ReaderLayoutTokens 后从 ReaderTokens 导出。282 个 `app.<组件>.<Builder>` 颜色角色迁移到 160 个语义 owner，逐项 day/night 值完全保留；图标资源角色与阅读配色保持各自用途，不按相同色值擅自改色。
- 320vp 书源行使用上下两行放置元信息与操作；移除书架死 readingFilter 分支与空态无效图标。
- 发现页移除重复的无行为筛选/应用展示，保留真实分类 chip；结果接入当前身份的详情打开与返回发现。未实现的权限卡（含虚假状态与“去设置”）移除；未开放的产品范围保持原状。

### 本地验证

六个点名 case 均 PASS：`viewport-rail`、`settings-migration`、`grid-height`、`action-semantics`、`sdk-navigation`、`discover-selection`。主题生成字节检查 PASS；282 项日夜颜色值保真和无旧页面角色消费者 PASS。未运行完整产品回归。

发现回调用例首次装载未传 SDK 的 ETS parser options，导致诊断对象格式化长时间占用 CPU；已终止本次自有测试进程（未影响任何构建/设备进程），补齐实际 SDK options，并把诊断限制为位置与消息后，该 case 在约 0.6 秒内 PASS。

### 构建与产物

- 最终 iteration 构建 PASS，contracts scope `none`，全量合同 `NOT_RUN`，`acceptanceEligible: false`。
- runId：`20261026T102957Z-3b297fdc-c5e7fb2f`。
- manifest：`.reader-artifacts/hap/20261026T102957Z-3b297fdc-c5e7fb2f/manifest.json`。
- signed HAP SHA-256：`c5e7ed147bc984479f7c9ecd91d5451b08593babc3718efd42e158631f77e819`。
- 指定证书 SHA-256：`3A563778E5BF17CD3EAD0218E13B4A5030DE3F5D7D4E21E0336D8EB37B676DC4`，debug Profile 与签名 verified。
- 构建源码指纹：`c5e7fb2f4c0d9f25efd3a6d1981de5ee737d7a0424970ec46d8702b33bf11af7`，1304 个构建输入文件。
- Harmony HEAD `3b297fdc7e724cf655eca3bac2a8efeda2001c56`，dirty；Core HEAD `80d614e929ae9e320ab767a1dc04579363c361d7`，dirty。保留全部既有 WIP，没有提交、stash/reset 或版本号变更。
- 构建前的失败尝试、SDK fixture 故障与最终成功均保留上述记录；成功不覆盖此前失败。

### 未执行证据层

VM 安装、真机安装、原生布局像素、实际读屏/键盘交互、分屏窗口实际操作与用户验收均未执行。未调用 HDC、未修改任何设备数据。SDK lowering 只证明生成的组件属性/回调，不能代替这些证据。

## 复审后续修复（2026-10-26，当前 dirty 工作树）

复审定位：底栏实际使用固定 68/50，clearance 固定；SDK `ets/component/text.d.ts:398` 明确数字 lineHeight 单位为 fp，手动乘 fontScale 会重复缩放。书架/多选网格存在相同问题，一并修正。两项旧结论已核对：权限卡及“去设置”当前已移除；主题 484 个唯一角色中 376 个为 app.*，1128 是三个投影中的重复次数，不代表 1128 个独立角色。

| 事实来源 | 消费者 | 唯一 owner / 本次修复 |
| --- | --- | --- |
| 字体行高与系统字号 | MainTabBar、内容 clearance | ReaderFloatingBarMetrics 用 readerScaledControlHeight 同时解析项/栏高度；文本显式 fp，不再手工乘 |
| 完整主宿主测量与导航偏好 | 四个主页面 | MainTabShell 唯一挂载 rail/bottom；SettingsShell 首页复用其标准滚动分支，保留业务浮层起始偏移 |
| 字体行高 | 网格与分组标题 | fp 文本只缩放一次；网格保留已有几何高度，分组头使用缩放后的最小高度 |
| canSave/actionEnabled/当前模式 | 书架设置与 bounded header | ReaderActionAccessibility；业务 owner 继续控制动作准入 |
| 详情内容 frame | 普通详情底部操作区 | 内容最大宽度消费 TOK_CONTENT_MAX_W_TABLET；dock 从同一 content frame 内缩 TOK_SPACE_SM，移除独立 680 上限 |
| 默认偏好、宿主宽高、字号 | 演示 | 默认底栏，用户开启 rail；重新生成可调场景，标注结构演示证据边界 |

导航底栏另发现 width 仍直接用上限而未消费已经解析的 frame.width，四 tab 窄屏会越界；现改为消费实际 frame.width。

本轮准确验证入口（执行前登记）：
- `node tools/test-main-navigation-audit.mjs --case viewport-rail,sdk-navigation,grid-height,sdk-followup-actions,shell-owner,detail-frame`：仅内存加载真实生产 TS 与 SDK lowering，嵌套现有有限 builder/字体/页面策略装载器，不执行其他用例或设备动作。保护缩放后的栏与内容 clearance、两种导航尺寸/文本单位、网格高度、按钮禁用/选中、单导航挂载与过期回调拒绝、详情 dock 有界。`grid-height` 将补实际文本 builder 的 fp 断言。
- 演示仅做本地浏览器初始状态、开关、宽高和字号场景检查；不作为原生运行证据。
- `node scripts/hap-pipeline.mjs build --class iteration`：与上节相同隔离编译、输入/Native 配套、指定证书/Profile、包资源与签名校验；contracts none，不附带全量或 HDC。跨组件宿主和 fp 参数变更必须真实编译确认。

本轮编辑前基线：`/tmp/reader-nav-followup-20261026-before`。未改变产品版本或产品范围，保留其他 dirty WIP。

后续复核发现新接入的书架模式按钮若仅查询普通 Host 对象的 canSave，未知 ACK 导致的禁用状态未必形成 ArkUI 状态依赖。现将页面持有的 `@State viewModeSnapshot` 显式传给同一 Host 准入方法（默认参数仍使用 Host 自有快照，点击 guard 不变）。这使显示语义追踪真实 owner 发布的快照，避免复制准入规则。仅重验受影响的 `sdk-followup-actions` 并重新构建。

### 本轮本地与演示结果

六个点名 case `viewport-rail,sdk-navigation,grid-height,sdk-followup-actions,shell-owner,detail-frame` 均 PASS；快照响应依赖补充后仅重跑 `sdk-followup-actions`，PASS。其余不受最后两行逻辑影响的结果保留，不补跑其他套件。

演示重新生成于 `docs/ui-design/main-navigation/reader-navigation-dual-mode.html`，原 Qoder 引用路径同步更新；生成入口 `node tools/generate-main-navigation-demo.mjs`，模板同目录。默认值读取当前 SettingsGateway 的默认快照，导航/尺寸/viewport/配色使用生产模块转译快照，导航计算源码指纹 `8c9daf415fb2a369a18ffca23f3602418332ebd2364e707c9f9cdd53d99ee29c`。背景书籍仅为示意内容，演示不写应用 Preferences。

浏览器首次尝试 FAIL：Python Playwright 自带 Chromium 缓存不存在，未下载/安装工具；改用本机 Chrome 的 headless 模式后 PASS。验证 9 项：默认底栏、开启侧栏、200% 字号、短窗口回退、599/600 边界、导航切换设置、恢复默认、末尾内容不被底栏覆盖、360px 外层无横向溢出；页面异常为 0。画面复核后修正演示外框多余空白，再次验证 9 项 PASS。截图 `demo-default.png` / `demo-rail.png` / `demo-phone.png` 保存在演示同目录。使用 webapp-testing 技能；本地浏览器结果不代替 ArkUI 原生验证。

第一轮 iteration 构建 PASS：`20261026T111059Z-3b297fdc-484a2ca8`，signed SHA `4f4402cd6700c7776b06ef1fb21a8f970b0e3d6cc322a1f468ef443ce41630c4`。最后的快照响应依赖补充发生在该包之后，因此该包不作为本轮最终交付，需以下最终 manifest。

构建尝试 `1793013347293-62100153-0af0-4ba0-8968-f23e38cae09b`：FAIL（输入一致性准入），OHPM / ArkTS assembleHap 均 PASS。workspace contract 指纹从 `345bb4f836384dd6222757d4a284aadd47d59d09456cb7a1e5eddc7f245eac1a` 变为 `f7ec0e6e002474936dc6b9b5f4852c92af07fb7dbfcc34edf85efbf376d70f40`；构建期间 19:15:56 更新的文件为 `Reader-Core/governance/workspace/DEVELOPMENT_BACKLOG.md`，不属于本任务编辑。未覆盖该并行改动、未绕过准入，待输入稳定后重建；不因此增加业务测试。

审计表中的统一样式“部分通过”同时收口：rail 与底栏外容器均使用既有 `TOK_RADIUS_PILL`，移除 MainNavigationSpec 的方向专属 24/34 圆角。此形状在栏高度随字体变化时仍为胶囊。只重跑受影响的 `sdk-navigation`（新增两方向 token 一致断言），更新演示并重复既有浏览器场景；之后重新构建最终包。

最后的依赖审计还发现：原导航模式只显式读取 mainViewportRevision/偏好，虽然声明了 windowMetricsRevision，却没有在决策路径读取。系统仅改变字号、宿主宽高不变时，rail 子项会变高，但模式和位置可能不重新计算。已将 metrics receipt 显式传入共享模式/位置函数，书架含状态/空态、发现、RSS 和公共壳同步订阅；不新增另一套模式状态。

因此新增并点名 `font-receipt`：SDK lowering 执行真实 MainTabShell.navigationMode，以同一 760×200 宿主、字体从 1 到 2 检查 rail→bottom，验证读取指标版本；AST 逐个确认所有生产调用包含该响应依赖。此问题由代码定位，无设备取证。仅执行 `--case font-receipt,viewport-rail` 并重建。前一成功中间包 `20261026T112128Z-3b297fdc-344f3eea` 的 SHA `7ca54c7f85c8d6531d5599c4c2693f77c05ae722db00a842dbaf0ed0bbf9a795` 不含这次响应依赖补充，不作为最终包。

### 最终交付记录（复审修复）

- 七个定向 case 均 PASS：viewport-rail、sdk-navigation、grid-height、sdk-followup-actions、shell-owner、detail-frame、font-receipt；分别按上文变更影响选择执行。
- 最终演示九项浏览器场景 PASS，源码计算快照 `bc9fd238e2b4d3e50790ef1e13fcd40e25154005e17bbc3dcb6b5176866b6788`；原 Qoder 引用与仓内版本字节一致。
- 最终 iteration 构建 PASS，runId `20261026T112407Z-3b297fdc-64381634`；manifest `.reader-artifacts/hap/20261026T112407Z-3b297fdc-64381634/manifest.json`。
- signed HAP SHA-256：`d5ba7e6466e508fe8f1fd391bac266f1cf258d65d4f2cf7e09cc4a058dbbcf3a`；指定 minliny_HarmonyOS 证书及 debug Profile 验签通过。
- 构建源码指纹 `643816344d70bd2bdfe441aa6f3ebbe0c6faed0bc5033a707dda1e53f4c1b52a`；交付前逐项核对 1304 个构建输入文件，当前工作树与快照 0 缺失 / 0 差异。
- contracts scope none，全量 NOT_RUN，acceptanceEligible false。VM/真机安装、实际读屏、原生像素与用户验收均 NOT_RUN。
- 保留既有 WIP 与并行 Core 待办改动，未提交、未变更产品版本、未调用 HDC、未清除数据。
- 当前 484 个唯一主题角色含 376 个 app.* 语义角色，无 app.<大写页面/Builder> 遗留角色；权限卡及无行为“去设置”当前不存在。本次没有把重复投影计数误当成新增迁移项。
