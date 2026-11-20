# 暖白跨页、表面层级与搜索静态方案落地（2026-10-28）

用户在跨页demo及内嵌/固定/悬浮/模态分层对照后明确要求“按这个方案实施”。范围是HarmonyOS App当前页面的暖白配色/承载层级和demo中已确认的搜索静态差异，不加入demo样本数据，不开放L0关闭的发现/RSS/同步，不修改阅读正文主题、Core、schema或签名身份，不调整动效时序。

## 当前输入与归属

- 当前工作区：`/Users/minliny/Documents/Reader/Reader-for-HarmonyOS`；Harmony HEAD `3b297fdc7e724cf655eca3bac2a8efeda2001c56`、Core `80d614e929ae9e320ab767a1dc04579363c361d7`、Reader-UI `95366cd93775ea0ad3ecbc0f60e8882717f93169`，均有既有dirty WIP，原样保留，不清理/reset/stash。
- 主题权威为`Reader-UI/theme/registry.json`，生成器负责HarmonyOS与Reader-UI适配器，不能手改生成Registry造成双owner。保护基线见`.reader-artifacts/warm-surface-implementation-20261028/core-protection.json`：正文reader分支、既有Night角色、TOK_READ/TTS/message/cover等独立hash。
- 当前主版本仍为0.2.0，本轮是dirty工作树上的迭代包，不满足发布patch的clean/验收准入，不改产品版本/安装计数器，不以版本变更替代buildId或兼容判断。
- 另一活动任务使用isolated工作树和本机VM，未发现当前源码路径冲突；共享本机HDC server有活动用户。设备交付只复用服务和同一租约域，不例行重启，不触及VM或另一目标。

## 生产source → consumer → 唯一owner

| 角色 | 权威/规格 | 实际消费者与例外 |
|---|---|---|
| 页面纸底 | registry DAY TOK_PAPER/TOK_SURFACE/window/download paper | 标准页/主tab/下载；ReaderShell正文underlay仍由原owner持有 |
| 内嵌卡 | DAY CARD_BG/HI F8F4EC + app.border.contentCard DCD2C0 | ReaderCardSpecs、继续阅读；sourceRow原为透明分隔行，不为demo另造白卡 |
| 固定栏 | 实体暖白/控制边界，无抬升 | AppTopBar/PageBackBar外框几何与elevation分离；设置首页保留同纸底 |
| 悬浮 | navigation surface/border + 独立navigation shadow | 底栏和rail、详情dock、下载dock；不借cover影，不再按night硬编码关影 |
| 模态 | 原native Sheet/Popup宿主 + mask/border/highlight + elevation | 书籍操作、筛选、历史、菜单、下载sheet；native host唯一外框，内容不增加第二框 |
| 阅读正文/控制/消息 | 原reader/TOK_READ/TTS/message专用角色 | 保持原色与事实分类，不被App纸底或普通modal角色覆盖 |
| 搜索内容 | SEARCH Typography/SearchPage | 来源名在左、轻元信息、简介/章节预算、短内容来源靠底；紧凑任务摘要、公共任务详情、原子筛选重置/关闭 |

`ReaderSurfaceSpecs.readerSurfaceElevation(kind,scheme)`为共享抬升参数owner；颜色仍在registry。固定/内嵌零影，悬浮/锚定模态/底部模态分别选择相应规格。历史已有Index路由HitTest/AX隔离，不能把demo焦点缺陷推给生产；只补表面/影/正确mask合成。

## 验证与交付计划（执行前）

旧demo浏览器PASS不能证明ArkTS/native效果。先完成代码与最小本地回归，最后用唯一HAP管线signed iteration构建并保留数据覆盖安装；这延续本任务先前已明确的真机安装授权，不卸载、不清数据、不换证书。

- 主题权威生成一致性与上述保护hash：回答新增App角色是否正确同步、正文/既有Night及专用色是否未误改；只核必要分支，不跑全theme历史集合或开放PH67。
- 公共Card与header/native表面SDK属性：只选实际改变的prop/paint/elevation case，不执行历史迁移hash/全路由见证。当前已只读查阅`H-reader-card-finite-specs#card-props`与`H-reader-page-header-contract#header-paint-owner`，尚未运行；最终是否必需按实际变更定。
- 搜索：真实SDK卡片的顺序/信息预算/选择身份；header facts冻结与新任务详情/retry owner；native filter Sheet装配、紧凑header和重置的原子身份守卫。历史容量/测量/完整行与输入图标行为未改则REUSED。旧physical-layout novel/comic及system-font card断言已落后于生产，不能盲跑或以其旧独立badge要求回退正确实现。
- 下载：固定topBar/浮动dock/native模态分流；普通sheet、operations、单确认及settings+cleanup双遮罩的真实底层合成，保留identity/generation/request生命周期。只补实际overlay与SDK装配场景，不扩大为下载业务回归。
- 构建：`node scripts/hap-pipeline.mjs build --class iteration --contracts-scope none --signing local`，只执行打包直接条件：工具/Native配套输入、指定签名与包名/Profile、隔离全项目ArkTS编译、包内容验签与manifest。无隐式业务全量。
- 设备动作：使用`reader-hdc-lease`经本机127.0.0.1:8710发现并核准当前精确physical target；完整调用链清大小写代理变量并设NO_PROXY/no_proxy=*，另核lo0/en0路由和实际listener/socket。当前服务健康则复用；不以离线提示推断手机问题，不为一次失败循环重启。
- manifest生成后按同一产物inspect→保数据install/launch；精确目标、boot/SceneBoard、证书/Profile与已安装身份分别检查。构建、安装启动、设备像素和用户验收分层记录。此处不安排无目的手机触控/重复截图。

所有最终选择的检查在执行前补齐准确case、入口/嵌套调用、风险与必要性；未选记NOT_RUN，失败保留。版本、源码、本地SDK、包、设备与用户认可分别记账。

### 已选最小本地检查

以下入口显式按case运行，最多两个并行worker；仅使用本机SDK/源码fixture，不触发设备、Core构建、业务全集或gate索引重写。当前probe定义为本轮评审过的局部适配，结果属于本地源码/SDK回归，不冒充冻结索引中旧SHA的门禁通过。

| 入口 | 嵌套与实际范围 | 本次必要依据 |
|---|---|---|
| `tools/test-reader-card-finite-specs.mjs --case card-props` | 真实Card规格与SDK属性fixture；仅卡片props | 内嵌卡边缘role改变，确认scheme/width/有限site仍受同一规格约束 |
| `tools/test-main-navigation-audit.mjs --case sdk-navigation` | installedEtsCompiler + 实际MainTabBar Builder + 真实SurfaceSpecs依赖 | 底栏/rail从cover影转公共浮层影，须保留焦点/选择/几何并验证真实helper被调用 |
| `tools/test-shared-download-visual-contract.mjs --case native-bindings,overlay-chrome` | installed SDK lowering + pureModuleProbe；真实ReaderScrimColor，对平台混色只给有限严格回执 | 该页topBar/dock/modal分流改变；导航带须按实际sheet底色合成，双层确认须不重复纸底，生命周期退休/退出守卫不能失效 |
| `tools/generate-theme-registry.mjs --check` | 读权威registry并核三个受控适配输出；无写入 | 新语义角色只能有一个authority，生成文件必须一致 |

未选的page-assembly与历史迁移case仍为NOT_RUN；下载native-bindings已覆盖该Builder的SDK装配，最终HAP还会做全项目ArkTS编译，无需重复同一装配测试。阅读字段隔离只比较6处旧Day/Night颜色回执，不扩大为阅读业务回归。

### 局部执行记录

- `sdk-navigation`：PASS。真实底栏/rail浮层角色、SDK属性及原有焦点/选择行为通过。
- registry `--check`：PASS（489 App roles×2、8 Reader palettes）；公共elevation/protection探针PASS：两种密度×两主题×五种表面、非法密度回退、漏换算负对照、正文/既有Night/专用角色保护及六字段兼容。探针与结果在本地artifact目录，不代表设备像素。
- `card-props`初次FAIL于旧fixture漏载真实ReaderTextStyle构造器及Button/FormField字号缩放成员/依赖；随后FAIL于SDK metadata初始化缺口。实际SDK先定义`__OBSERVED_OBJECT_NAME` Symbol，旧property probe只提取类体，漏了该bootstrap；按原SDK初始化行补入每fixture独立global port，所有warn仍严格失败，不解冻对象、不改生产Card。之后真实断言暴露旧r13基线；适配当前共享TOK_RADIUS_LG，并保留独立variant/规格mutation负对照，未刷新旧golden或gate SHA。
- `card-props`修复后PASS，48组真实消费者×scheme×width属性，保留V1更新、变体隔离和fixture隔离；原FAIL未改写。原始最新结果见`.reader-artifacts/warm-surface-implementation-20261028/card-props-current.log`，前一次断言失败见`card-props-final.log`。
- 下载的已发生FAIL与后续精确回执分别保留；目前还未将下载检查判为PASS。所有失败先定位实际import/fixture缺口，不通过改生产业务满足旧断言。
- 后续下载准确`native-bindings,overlay-chrome`双PASS（exit0），最终回执`download-consumer-final.json`；原retry1～6和overlay-retry1仍保留FAIL。补齐真实Motion/Select/Dialog依赖及原有初始化器后，最后将已过期的状态actor“下载失败”定位改为实际“重试”，同时保留danger色和“下载失败/重试”可访问语义断言。没有执行其它case。结果只证明SDK属性及实际异步owner方法，不代表native像素。

Root补充接入：书架More与阅读More的实际Popup宿主使用公共popover影；LibrarySearchSurface由外层绘影、原内层裁内容，FixedHeaderHost原transparent policy不裁外影；固定栏边界/展开历史边界分别接既有公共角色。搜索mask使用带alpha的modal角色且opacity仅进度，避免透明度重复相乘；bookPanel输入改共享field角色，Night仍是本轮前的282420。

### 搜索最终选择（执行前）

- `node tools/test-search-static-implementation.mjs --case result-card,compact-sheet`：使用installed SDK parse/lowering、真实V1属性类、真实SearchResultCard及共用compact header；对Task/Filter的native Sheet Builder只检查显式选中的属性/组件接入，native布局/混色/动画为声明的端口。回答来源顺序、轻字体、简介/章节互斥预算、详情元数据保留、公共header/原生host材质、原子reset和过期身份/retry不越权；新代码替换了这些呈现与回调接入，因此不可省略。
- `node tools/test-search-status-summary.mjs --case summary-builder`：实际SearchPage SDK摘要Builder与真实子组件声明，核一份冻结事实传入新公共任务详情，页内不再堆失败/跳过提示或重试块。本轮改变装配边界，因此需重跑。
- 原`status-labels/task-summary/retry-owner/header-facts`的业务方法保留，由现有准确方法证据复用，不因总记录仍OPEN重跑；历史容量/完整行/自然宽度/图标/动效时序不在本轮改动，保留原证据边界。

本轮搜索子agent在落完生产与新case后被模型容量中断；Root接管未完成的执行与任何必要修正，不把未跑case判为通过。

搜索局部结果：`result-card` PASS（search-static-attempt-2.log首条，后续compact失败不改该局部判定）；`summary-builder` PASS（search-summary-current.log）；`compact-sheet`最终PASS（search-compact-current.log），并明确核两个native-owned内容不再绘第二个background/border/radius/shadow，实际Filter Sheet选BOTTOM并接公共host影/遮罩/边。初次fixture把函数当变量选择、宽泛tail fixture的无关icon依赖、skipped-only错误期望均保留FAIL；改为只挂真实结果Row的准确SDK fixture、以pure loader加载实际函数、保留业务“跳过≠本次失败”的状态语义，没有改业务迎合断言。

最后一次源码审计补5处浮影外框clip=false（Main bottom/rail、Local详情dock、下载storage/selection docks）；内部圆角与受限内容保持，未增加框或改几何。`sdk-navigation`/`native-bindings`新增准确clip断言后均PASS（floating-owner-clip-result.json）；overlay-chrome行为与颜色未再改，复用此前PASS。所有生产与tools写入至此冻结，下一步是同一候选的isolated signed iteration构建。

### 构建资源等待

首个HAP attempt `1793194644328-669cfd8a-339d-4695-b041-5364b5564b99` 于构建资源准入FAIL，stages为空，未执行编译/签名/设备动作。规范共享锁owner PID76465真实存活，其子进程正在另一isolated iOS工作树执行单任务Cargo/rustc，已核不是stale owner；未清锁、未终止、未改锁域或并行绕过。保留该FAIL，待既有owner正常释放后再执行同一冻结候选的HAP构建。此等待与HDC、手机或签名无关。

资源正常释放后第二次构建进入全项目CompileArkTS，发现两个本轮新增编译约束：Record值的内联对象未获ArkTS显式类型上下文，以及TaskPanel私有`scale()`与CustomComponent基类API重名。前者改为显式规格class实例（公共参数/密度换算不变），后者改名`fontScale()`；原FAIL日志保留`hap-build-attempt-2.log`。只补公共elevation与compact-sheet准确探针，均PASS，其它未受影响局部结果复用，不重跑业务全集。接续新冻结候选构建，不把SDK emit当全项目类型检查。

第三次构建消除了方法重名，但外层Record仍被ArkTS拒绝，保留`hap-build-attempt-3.log`；改为有限规格实例+明确resolver，五类参数不变，公共elevation准确探针PASS后执行第四次构建。

### 产物与真机交付

- 第四次isolated signed iteration构建PASS：runId `20261028T134731Z-3b297fdc-e96d2593`，完整CompileArkTS与HAP内容/Native/签名校验通过；原有warn未作为新的业务PASS。管线contracts scope=none，未隐式运行全量；本轮局部SDK结果独立记录。
- signed SHA256 `56520976ba474dc627af2ecdce5c3944ca5df9f46fbcb949592eca27d49a2fb0`，证书`3A563778E5BF17CD3EAD0218E13B4A5030DE3F5D7D4E21E0336D8EB37B676DC4`，包名`io.reader.minliny`。manifest保留在该run目录，不改版本号0.2.0或安装计数器。
- 真机targetRef `2a10c2b26b06`。交付前本机server127.0.0.1:8710的准确target为Connected；复用原listener PID38557，实际HDC socket向设备ESTABLISHED，设备路由en0，完整CLI链清代理变量/NO_PROXY=*。未走远程VM server，未重启共享HDC，未触及VM目标。
- 同一manifest的physical inspect PASS，route=`matching-identity-signed-update-candidate`、preservesData=true、bootCompleted/sceneBoardStable=true。实际`install -r`已成功，post-install身份复核通过；随后启动因系统锁屏`10106102`失败。保留`physical-install.log`原FAIL与run内installOutcome=PASS的resolved保留标记；不重新安装、不卸载、不清数据。
- 已向用户请求解锁，只待补一次准确目标的启动；尚未宣称launch、设备像素、交互或用户验收PASS。源码/SDK、签名包、安装、启动与视觉验收分别记账。

用户回复“已解锁”后，仅使用同一本机server/准确target的租约入口补`aa start`，完整调用链继续清代理变量并设NO_PROXY/no_proxy=*。命令exit0且设备明确返回`start ability successfully.`，launch现为PASS；复用已安装的run `20261028T134731Z-3b297fdc-e96d2593`，未重新构建或安装。补启动原始回执`physical-launch.log`与汇总`delivery-state.json`保留；原锁屏失败不改写，设备像素/功能交互/用户验收仍OPEN。
