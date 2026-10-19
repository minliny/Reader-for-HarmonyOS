# 消息样式全量实施

- 源码起点：`5a01ec1cdbd5ec864046e1b9202963ead23a513a`，原 main 工作区干净；实施分支 `codex/message-ui-unification-20261019`。
- 触发：用户逐类审核 demo 后，于 2026-10-19 明确要求“按方案全量执行”。批准范围见 `../message-ui/approved-scope-20261019.json`。
- 问题：现有共享 Dialog 只统一了外框，变体字号/圆角/动作仍不一致；恢复消息混用固定头部、底部和嵌入卡片；普通读回失败与原操作待处理复用同一呈现。漫画未知图片使用巨大兜底比例，失败占位只覆盖首个可见错误。
- 源码定位：公共 ReaderRecoveryNotice/Action、ReaderDialogSurface/SurfaceSpecs；各页宿主与 receipt/readFacts 投影；阅读书签、搜索与漫画图片行。先改源码及现有 SDK/业务探针，不通过设备反复试错定位。
- 实施边界：21 个原不合格分组及确认的阅读补充；已排除的标签、章数、阅读进度、状态点和无封面保持原样。原操作 identity、generation、CAS、核对/继续准入及数据保护规则保持。
- 验证层级：源码实施、主机行为/SDK、本地产物、安装、原生视觉/交互与用户验收分别记录。已进行规范本地构建准入，尚未进行设备操作，不代表原生验收。

## 验证中发现的问题

1. 正文搜索后续结果失败会释放分页游标并关闭 hasMore，原 UI 重试入口无法履行批准行为；先审计 Core 游标消费边界，禁止用旧 offset 猜测拼接。
2. 旧视觉/架构探针锁定历史元组和嵌入位置；保留原基线，新增批准后继证据，不以删除业务断言使测试通过。

3. 规范 iteration HAP首次准入因新消息测试未分类而停止；补入 integration 清单，未跳过测试。
4. 第二次 HAP准入在 `generate-build-provenance-manifest.mjs:248` 停止：现有本地 Native 的 Core build identity 与当前 clean Core `b52365329f1312c7bb80605c8a74eecaf8f4bc44` 不匹配。失败记录 `.reader-artifacts/hap-attempts/1792343090077-d9da28ce-9721-463c-bd86-44465f7cf95b/stages.json`。按现有 `scripts/build-harmony-napi.sh` 重新生成，再通过规范 `sync-native` 校验同步；未修改 Core业务、不借旧 SO、不操作设备。
5. 收尾真实组合回归定位并修复：导入的普通已确认读回忙态曾因 selectionEnabled 被禁用而误当 unknown；新增显式 originalPending事实，Prop先于recovery Watch更新。长漫画整图失败曾按tile重复图标，改为逻辑图外框和中点单标，保留已可读片段。对应反例与durable回归通过。
6. 规范 Native 重建、桌面 NAPI/Rust/SQLite 回归及 ARM64 release 已完成；`sync-native` 校验同步通过。Native SO SHA256 为 `dce3b47e92f8c8a9c3e2c49d4635d618ab456fe8cedc80426020dc2ae36dfa00`。仅本地产物，未部署。
7. 第三次全量 HAP 准入运行中发现真实剩余分流：分组确认但 durable 清理 blocked 时提前关闭入口；阅读目录已确认/明确部分结果仍挂待处理浮层；已打开漫画仍有 preparationError 旧嵌卡；历史 completed/stopped 书源检测吞后续操作 Toast。停止该次构建，向自有 contract runner 发送 SIGINT，runner 回收自有子进程，无 HAP 发布。失败/中止记录 `.reader-artifacts/hap-attempts/1792343325802-597d49a4-6ef3-43ab-9331-bcfc8ed9c7b7/stages.json`；未运行项目不记通过。
8. 同次全量检查暴露旧 UI 探针仍查找手绘旋转图、旧嵌入 Notice/36 高 Text、旧 Dialog 元组。保留历史基线和事务/身份断言，更新当前批准样式的有限后继和实际 SDK 组件接线。新增 PageState/Watch 依赖属于真实源码组合，禁止空 stub 吞掉编译诊断。
9. 分组关闭条件补充 `managementMutation.blocked !== true`；实际生产方法回归覆盖 confirmed 成功、confirmedRefreshFailed、confirmed+blocked、unknown 四种结果，仅前两种关闭，普通读回失败 Toast、未决原事项入口保留。原写入各只调用一次。
10. 最后只读复核又找到：已收到严格 ACK 的漫画换源读回失败仍进通用浮层；普通阅读失败仍借用待处理浮层；漫画已打开时设置/定位等错误仍可能触发旧背景块。分别改短 Toast，保持原可读内容、书架/目录入口、错误事实及真实 unknown/恢复分支。缓存重新验证的显式原决定仍保留，失败只短反馈并重建原决定入口，不能被一次性动作消费隐藏。
11. 目录加载曾按“正在/加载/读取”前缀推断；上游错误原文“读取失败…”可误画 loader 并隐藏重试。改由 ReadingEntryHost 发布明确 `catalogLoading`，Index 和详情/目录/阅读宿主以 `catalogBusy` 透传，不再从显示文案推断忙态；真实 Host→Index→SDK 反例验证单独记录。
12. `test-reading-entry-index-sdk` 的取消成功场景发现：取消严格完成后，晚到 add rejection 可把无 add receipt 的状态再次标成 unknown；相反完成顺序也会遗留 unknown。此前正文不分流掩盖此事实错误，新待处理分流会误挂未确认提醒。最小修复只维护已确认取消的优先级，不伪造 add ACK；无 add receipt 的已确认取消回到 none，取消失败仍未确认，membership 仍只是当前成员观察。两种异步顺序与原 Core/Runtime 边界分别回归。
13. 书源工具的再次只读失败曾仅更新 readFacts，继承选择操作的历史静默 statusEvent，导致有旧列表时无失败反馈；在实际失败发布点补本次反馈事件，保留列表/选择，不触发写入。
14. 部分宿主已换共用 Notice，却未传真实核对忙态；canRetry 暂停时动作会消失。按已有 owner 的明确 busy/checking/refreshing 事实补齐宿主透传，验证标签保持测量占位、18vp 原生加载且重复动作受阻；不以不可重试推断忙态。
15. 第四次完整准入实际执行全部 703 项，643 通过、60 失败，耗时 646193ms；规范记录 `.reader-artifacts/hap-attempts/1792344662432-d66dd220-f617-4176-b34f-32cbba3dd882/stages.json`。无 HAP 产出。失败集中在历史嵌入消息/旧字体和 Dialog 断言、缺少实际新组件/Watch/业务初始化的 SDK 样本、SVG 来源登记。完整清单与子日志保留，不把嵌套负对照的预期 FAIL 计入失败数。
16. SDK 后继探针挂载真实共用消息子组件及真实 Watch 方法；页手势样本使用现有 `createReaderPageGestureState()`，不添加空业务 stub。颜色回归逐一证明原 31 个前景站点：16 个直接 AST、11 个公共控件、4 个批准消息后继，保留日/夜/日与原动作接线。
17. 图片失效图标接入既有 SVG 生成/验证流程：固定 `lucide-static@0.468.0`、完整许可、源/包/许可哈希和两种有限颜色配方；不再依赖脱离登记的 SVG。删除已退役且无生产引用的 11 个空态/导入旋转装饰资源，保留历史 Figma 来源目录。规范同步和来源验证通过 413 项，现存其他资源字节未改。
18. management-receipt 真实消费者回归发现，分组已确认但读回失败、有旧数据时，Toast 已替换旧卡，却漏保留当前页纯读入口。在 `BookshelfManagementPage.statusCard` 补共用小型“刷新列表”文字动作，限定非原事项未决且现有 recovery 准许重试；沿用原 generation/onReconcile。没有恢复常驻错误正文，也不重发写入。
19. 书架设置两处初读页态仍使用 `!canRetry` 推断加载；改用明确 loading/refreshing facts，显示方式首次读取用实际 load Promise 的局部忙态。取消/受阻/未读不再转圈，同 revision/mounted 才能清除忙态。无 owner 业务变更。
20. 编译前 SDK 类型复核补齐 `ReaderRecoveryNotice` 的 `MeasureOptions` 显式类型导入；测量参数已与当前本机 SDK 对照，公用实际 SDK 消息回归仍通过。
21. 第五次完整准入执行全部 703 项：694 PASS / 9 FAIL，673550ms，无包产出。记录 `.reader-artifacts/hap-attempts/1792346380243-e33e0072-e605-4bc1-9adc-f93ad831cb49/stages.json`。9项收敛为三处接线：新增类型导入及明确 busy facts 尚未同步精确架构实现/输入见证（2项）、有限新增 State/Prop 字段未触发实际 ArkUI Object/OneWay property runtime（5项）、书架 Shell 实际 Watch 所需的高度回调初值未选入样本（2项）。逐项修复并复跑；未修改业务生产实现，也未缩减清单。

## 完成记录

21个原不合格分组及确认的7项阅读补充均已完成源码接线；覆盖表见 `../message-ui/implementation-map-20261019.md`。第六次完整规范构建通过：703/703、omitted 0、全工程 ArkTS、非增量构建、指定证书 debug 签名及包内校验均 PASS；按不可变 manifest 离线复验 PASS。

成功 run：`20261018T182618Z-5a01ec1c-ffaa901e`；manifest：`.reader-artifacts/hap/20261018T182618Z-5a01ec1c-ffaa901e/manifest.json`。最终证据见 `../message-ui/shared-verification-20261019.md`。这是含本次未提交改动的 iteration 包；未安装/启动/操作设备，设备交互及用户验收保持 OPEN。

## VM冒烟后的修复（2026-10-19）

用户明确要求“定位并修复”。原VM基础记录见 `../message-ui/vm-smoke-20261019.md`，原生截图与布局已保留，原部署包不覆盖。

- F1：书架设置进入后持续显示“显示方式尚未读取”，封面/列表缺失。代码定位为Store已保存canonical与Host初始空snapshot两份状态分离，生命周期按前者跳过load，页面按后者隐藏选项。修复与真实生命周期→SDK渲染回归进行中，须保留unknown receipt及旧generation准入。
- F2：消息文字明显偏细。消息角色绑定可变字体，部分组件完全未传字重，其他数值weight也未启用可变轴；现有字体说明已有相同VM风险。复用项目已打包的静态400/500/600字面及checked启动加载进行修复，字号、行高、颜色和排版不变；须以新包原生截图复核。
- 新构建的Core现场与原包不同：当前Core存在其他未提交的工具链/可移植性改动，保留原样，不回滚或提交他人工作。原Native为clean Core生成，需先按规范重新核对/生成配套输入，新的manifest如实记录dirty；不得拿原包证明本轮修复。
- 本节是修复开始时记录，不表示本地回归、重建、新包安装或视觉问题已通过。

修复输入已冻结：F1仅修改Settings的完全冷snapshot初始化，不改变Host或书架页事务；回归先以旧源码复现选项为空（exit1），修后覆盖cover/list、真实启动后SDK渲染、无额外IO/重挂载、实际Runtime退休lostACK unknown回执及failed readFacts保留，全部通过。关联settings-layout、settings-operation-sdk、精确字体契约通过。

F2六个消息角色改现有静态400/500/600，启动checked等待加入500/600，四个批准Dialog头部用静态600，Notice动作测量与实际绘制同用MESSAGE_ACTION。扩展现有font-demand/message-style SDK回归，无新测试分类；九项字体/SDK/启动回归通过。原动态文本600字体保留完整CJK，未使用900固定标题子集。

规范Native preflight实际拒绝旧clean身份；`scripts/build-harmony-napi.sh`重建与 `hap-pipeline.mjs sync-native`均exit0，SDK smoke PASS，Native输入SHA256 `77269d37751f2a38face58fc21907794dd95023540ee257c9f5c88a567f678a6`。无Core生产源码修改。架构有限后继只更新四个Dialog头部family及Notice测量，其他shape/预算严格相等；后继SHA256 `6847a4a3e94cd95bde59da3fffe745f06a79c689f27eb6d2f5ad3b0a39f0cc61`，两项完整architecture producer/consumer本地检查exit0。随后重新执行全量规范HAP流程，不复用原703项PASS。

本轮首次完整修复构建实际703项全部执行，701PASS/2FAIL，合同阶段688537ms；失败记录 `.reader-artifacts/hap-attempts/1792385494233-ce4be81a-05b6-423b-97e5-42b8626466de/stages.json`，未发布HAP。两项均为旧可变字体名字的直接断言：`test-manga-directory-empty-sdk:66` 的消息标题期望旧VF而实际为静态600，`test-theme-primary-text:113` 的消息正文期望旧VF而实际为静态400。已记录具体差异，按本轮静态字重修复更新有限消息预期，保留所有原字号/颜色/动作和普通UI断言后重跑；不删除失败项、不复用701项历史PASS作为下一轮凭证。

第二轮完整703/703 PASS，omitted0，规范无增量signed HAP构建及离线verify PASS；新run `20261019T051558Z-5a01ec1c-8508d63b`，signed SHA256 `21e2486d723f3174e3d36b7d1fa59b562deb63632a65669fcb14554aa6be2462`。同一原VM保数据install/launch PASS。F1实际首次选项、切换列表、返回列表、重入仍选中及恢复封面PASS；F2实际筛选空态/导入框字重与原动作PASS。最终恢复封面、全部筛选，3本书及可见进度保留。F1/F2本轮基础问题已关闭；复杂故障分支、真机及用户验收不在本次通过范围。完整记录与截图见 `../message-ui/vm-fix-20261019.md`。

## 下载往返与控制栏手势反馈（2026-10-19）

用户在已安装开发包 `5f67b379636d2718ddf60349c041018c3e355c94c176499f87407a38d07a2092` 上反馈：章节进入阅读前底窗闪现；阅读返回后章节下载重复加载；管理中的快速选择只显示“快速”；返回书籍下载列表底栏空白；完整控制栏收回快捷栏不跟手、难触发。当前源码为未提交工作区，旧包和历史检查不作为本轮通过证据。

- `SharedDownloadPage.showReadTarget` 先设置阅读底窗再派发导航，形成短暂闪窗。
- `Index.onReaderExited` 重新调用清空投影并新建 Host 全量读取的 `openDownloads`；原页面未保存章节滚动位置。修复仅在同 Runtime、已加载投影的阅读返回中恢复原投影，并按真实下载时钟增量更新；冷进入和显式刷新仍读取。
- 快速选择按下载专用字体及30vp装饰测量，实际默认Select字体及装饰需要更宽空间，导致裁切。
- `totalBytesLabel` 在任一容量未知时返回空串，底栏第二行也固定为空。这解释底栏文案空白，尚不能证明图标也消失；未知容量不得伪造为0。
- `beginReaderControlDragSegment` 将Full向下路由为18vp关闭段，绕过Full到Quick的可逆帧轴；原抓取范围仅72×28。修复为先沿原轴回Quick，越过Quick再关闭，保留反向及重新抓取。

本节是定位和修复记录，编译、产物、设备与交互验收尚未完成。遵守用户最新要求，不运行全量门禁，不同步旧视觉测试基线。

本轮修复及必要验证：

- 下载进入阅读直接派发原导航；快速选择按实际默认Select字体及40vp装饰测量；容量未知时保留明确文案，不伪造容量。
- 阅读往返复用同Runtime已加载快照和章节滚动位置；仅对下载时钟变化书籍更新章节状态，并通过既有 `bookshelf.get` 更新刚阅读书籍的已确认进度元数据。异步下载状态不能覆盖较新的书架进度。
- Full向下先到Quick，越过Quick才关闭；新增19vp顶部空白带命中范围，边界限制到实际shell/header/content，不覆盖标题按钮。
- 忽略目录内的真实Host/控制状态定向行为检查通过：无书架/章节重复读取、单书变化更新、旧回调隔离、进度与状态并发、七模块Full到Quick和反向连续性；这不是原生手感验收。
- 首次开发编译因Map.set表达式返回值与void回调类型不符失败，已改为语句体；Native配套编译完成，未运行其可选测试。最终开发编译、打包及指定证书签名通过，11.862秒；signed SHA256 `3b50704cbb7e8b75b9cdd26eee0177fae744aba458d96bb429ee41c0c0d3bb19`。记录 `.reader-artifacts/download-navigation-repair-20261019/development-build-final.log`。未跑全量门禁。
- 真机安装及交互状态以后续部署回执和用户反馈为准，不由本地检查或签名结果推定。

新包保数据覆盖安装及安装前后身份核对通过，目标引用 `b1f20b88963d`；启动被系统锁屏拦截（10106102），未重复安装、未关闭开发者模式或自动解锁。部署记录 `.reader-artifacts/download-navigation-repair-20261019/development-physical-install.json`。真机交互和手感验收仍OPEN。

## 入口、当前章节与跨页返回（2026-10-19）

用户追加：书架更多增加下载管理；章节下载标明当前阅读章；下载列表“请稍后重试”按钮不美观；书架→阅读→书籍信息→系统返回错误地回书架。随后要求找回旧交互文档，整理全部连线和原则，再按逻辑联系检查当前应用。

- 书架 More 原来没有下载入口。现增加同一受理/退场链的第五项，Index 绑定当前 Runtime/navigation/mounting；菜单规格同步五行。
- 章节当前阅读改用 `currentDownloadReadingChapterIndex`：同书、真实阅读记录、当前可导航章节三项同时成立；文字不凭 catalog 的 currentChapterIndex 猜测已读位置。标签、定位、快选和默认阅读目标共用此判定。
- Host 把 `job.error` 直接写进 `stateLabel`，UI 又将其当按钮 caption，并用固定状态文案判图标/颜色，导致整段兜底文案进入按钮。现有限状态“下载失败”、短动作“重试”、独立 `downloadError`；投影读失败仍独立。原现场只有兜底，具体底层异常无法由此恢复，不能断言是网络或书源故障。
- 详情仅记录 shelf/search 父级，没有 reader 来源；下载和换源回程也可能经新 book admission 重置来路。现保存当前 Runtime 的有限 ReaderReturnContext/DownloadReturnContext；阅读保存退出后才开信息页，页内和系统 Back 共用原返回决策；新实体准入与子页往返分开。
- 组合审查发现 Reader A→信息 A→下载→Reader B→下载→信息 A 的原 reader 上下文会丢；从下载起始时还会覆盖最初下载父级，形成循环。现捕获此前不可变父级引用、下载 view state 和加载完成投影；先捕获再赋新目的地，回程逐层恢复，拒绝旧 Runtime/reader 回调。
- 已确认换源改变成员时，保留旧下载 rows 会遗漏新来源并遗留旧成员。现仅该身份变化例外使快照失效；revision 阻止旧父上下文复活过期成员。query/filter/scroll/parent 仍保留；普通未变化往返不扩大为全表重读。
- 本轮实际生产普通方法及下载投影 12 组定向行为检查 PASS，记录 `.reader-artifacts/interaction-wiring-20261019/targeted-result.json`。有限 IO/lifecycle 端口不证明 ArkUI 像素、原生 Back 调度或手势体验。
- 首次开发编译发现 Index 三处对象展开不符 ArkTS，已改原上下文不可变引用与显式字段复制。最终编译/签名/包内验证 PASS，9.446秒，signed SHA256 `83e2584afc2d81047e8a27d5feb10aa662c5d61ebacf21885a67aaf1f7631976`。首次失败与最终日志分别保留；未跑全量门禁。
- 本轮交互梳理见 [主记录](../architecture/interaction-wiring-20261019/README.md)。旧28工作流/211步登记与当前路由、动作、状态保留分开对照；未逐一动态重验211步。可见入口、仅保留回调、产品禁用路径分别登记，未接入的声明不算已开放功能。
- 构建完成时真机 USB Offline，安装尚未进行；已请求恢复连接。后续以本轮部署回执更新，不复用上一包的安装结论。

2026-10-20 00:02（上海时间），用户确认已连接后重新发现同一 USB 真机 Connected；本包 `83e2584afc2d81047e8a27d5feb10aa662c5d61ebacf21885a67aaf1f7631976` 指定证书验签、覆盖更新前后身份核对、保数据安装和启动均 PASS。目标引用 `b1f20b88963d`，实际部署回执 `.reader-artifacts/interaction-wiring-20261019/development-physical-install.json`。未重新构建、未运行门禁、未触碰 VM；本次没有执行功能操作，原生交互/视觉及用户验收仍 OPEN。
