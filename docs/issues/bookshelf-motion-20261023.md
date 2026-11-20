# 书架筛选与阅读往返动效（2026-10-23）

范围：`main` 上的 `BookshelfPage`、`BookshelfViewState`、`Index` 和新的视觉转场组件。保留已有并行未提交修改。仅开发实现与开发包验证，设备交互与用户验收未执行。

## 2026-10-27 搜索面与开书过渡重构

- 待解决：搜索路由卸载书架且书架和搜索分别拥有顶栏；开书 actor 以整窗 aspect-fill 并变换阅读层，与页面矩形及固定书脊目标不一致。当前输入为 Host `main` HEAD `3b297fdc` 加现有 dirty WIP；`Index`、搜索、书架和转场均包含未提交工作，须原位保留。历史 15 项探针和旧包不覆盖此次输入。
- 几何与生命周期链：书架顶栏由 `BookshelfShell` 测量并回传 `Index.shelfHeaderHeight`，书架内容消费该值；`SearchPage` 独立测量其 header，并以同一内容起点处理列表间距及滚动锚点；`Index` 的搜索回调由 route、generation、mount、runtime owner 和 host 共同守卫。阅读转场的源封面由书架测量，目标目前为 Index 的窗口矩形，阅读层还消费 `onPagePose` 变换。目标是各表面只有一个几何 owner，并保留所有现有身份与滚动语义。
- 本次计划验证：纯时间轴和矩形合同的边界、反向及过期身份探针；完成搜索接线后选择 `H-search-index-action-attachment` 检查旧回调失效和当前回调可用；按实际修改扩展 `check-header-geometry.mjs` 并显式运行，仅覆盖几何所有权。`default@CompileArkTS` 仅用于编译验证，但现有 Hvigor 入口还会初始化签名及执行 Native preflight，输入不匹配时可能自动重建和同步 Native；这些额外动作是否必要尚待限定，不能直接把该入口称为无嵌套。以上不选择业务全量或设备操作。旧证据不复用于变化的行为；签装、逐帧视觉、真实帧率和用户验收保持 OPEN。

## 实现前的问题与处理

- 筛选由条件 ListItem 直接挂载/移除，关闭没有收起过程。改为自然测高的常驻裁切容器，关闭保留筛选条件；同一个入口可展开/收起。
- 现有书架点书直接切阅读路由，返回走既有退出 owner。添加独立视觉层；导航和阅读加载不等待动画，返回仍在退出流程批准后触发。
- 返回时原书卡位置可能已变。书架恢复滚动后重新测量同一本书的可见封面；超出视口、被筛选移除或四帧内无目标时淡出，不使用旧位置。

## 实现审查发现

2026-10-23，首版筛选使用 `animateTo` 写终点状态；中途开启减少动效再以 duration 0 赋相同终点，是否立即取消平台呈现中的动画不能由 JS 状态探针证明。证据：源码状态在动画开始就已是终点。处理：使用已有帧回调、时钟和平台曲线采样，保存当前呈现值，反向与减少动效均立即失效旧 generation。该修正待本次限定探针与 ArkTS 构建确认；像素连续性仍须设备观察。

## 本次验证入口及边界

1. `.reader-artifacts/bookshelf-motion-20261023/verify-navigation.mjs`：SDK AST 提取本次真实组件方法和几何函数，控制帧/时钟/平台边界；仅验证筛选反向、过期帧失效、actor 等待/降级和 Index 导航路由/身份保护。不调用其他门禁、Core 构建或设备；必要风险为旧帧影响新页面、导航等待动画和错误返回几何。
2. `git diff --check -- <本次修改文件>`：检查本次补丁空白错误，无嵌套脚本。
3. `node scripts/hap-pipeline.mjs build --class iteration --contracts-scope none --signing local`：规范开发构建入口，嵌套实际工具链/输入配对、ArkTS/native 编译、开发签名与产物检查。只执行构建直接必需条件；合同门禁未选择。用于确认当前主分支修改可编译、包名/Profile 与指定证书匹配；不执行安装或设备操作。
4. `node scripts/hap-pipeline.mjs verify --manifest <本次相同输入开发包 manifest>`：仅核验可复用产物的清单、哈希、签名身份和 Native/SDK 配对，不运行业务门禁或设备。并行任务完成相同输入的构建时复用该产物；逐项比对本次动效源码与探针/包内 source-snapshot 的哈希，防止把其他版本误报为本次产物。

初次临时探针 7 项通过（actor/filter 初版），只证明其列出的受控方法逻辑；后续修改后需更新结果。最终源码、构建、产物与设备结果分别补充在此。

开发包首次尝试在编译前停止：保留预算 10 已被 10 个受保护历史包占满（attempt `1792770343641-81a70aa3-f0a3-4cac-83e3-20c0c8736d37`）。不清理受保护产物；本次重试使用 `--keep-runs 11`，仅为新增开发包多保留一个位置。

第二次开发包编译失败（attempt `1792770443323-b6353b3b-f350-48b7-8929-641542e739c1`）：本次动效文件无报错；现有 dirty `LocalReadingExperience.ets` 的三个 catch 重抛缺 Error 类型、一个 builder callback 缺 void 返回类型，以及 dirty `EntryAbility.ets` 的 AppStorage 初始化误传三个参数阻止 ArkTS 编译。已先保存这两个文件的修正前副本；仅添加显式类型并拆分 Toast/host 初始化，保留已有业务修改。需要在修正后重新构建，不能把此失败记录计为产物通过。

源码审查同时去掉了新外层 Stack 的安全区覆盖，内部原路由继续负责安全区；窗口变化的下一帧复核读取当前请求，避免同帧新请求跳过尺寸校验。阅读层直接挂载，封面外区域的交接观感与 Scroll 零高自然测量仍属于后续原生观察项。

第三次尝试在编译前因共享构建资源正被占用而退出（attempt `1792770568035-80b10d6f-969d-46f5-9016-591b680b2504`）。随后只读检查确认锁已由原 owner 释放，没有删除锁或打断其他任务。

最终限定探针 15 项 PASS（含同帧窗口变化与请求替换的两个分支），源码 SHA 绑定记录于 `navigation-probe-result.json`；探针脚手架曾因 Node 不接受顶层 return 失败，修正脚手架后的重跑通过，历史保留于 `verification-attempts.md`。非原生视觉验收。

第四次尝试（attempt `1792770623067-c3fdbd77-e58b-4b78-a717-d9d00c126041`，`--keep-runs 12` 为并行任务及本任务各预留一个位置，实际未删除旧产物）编译时遇到并行变更的中间态：`LocalReadingExperience` 已传入 `ttsConfigurationLoading`，其对应 `ReaderControlPanel` Prop 尚未进入该次快照。随后当前工作树已由并行任务补齐这两个 Prop，不覆盖其代码；等待输入稳定后重试规范构建。

第五次尝试因共享构建锁退出（attempt `1792770777348-87d46cbb-c393-4243-86ca-3c4a6f61f89c`）。原 owner 随后发布相同输入指纹 `be3ba8599792f26dfbfa083008cfcd2da8b48544a915f27829a14cf1e0091d62` 的开发包 `20261023T155303Z-6b1bd753-be3ba859`，对应 main HEAD `6b1bd7534b61a8ebfac10150fd308eae8430606e` 和当时 dirty 快照。本任务复用该产物，按上述入口验证。

## 最终结果

- 源码：动效接入 `main`，未提交，保留并行 WIP。
- 定向逻辑：15 项 PASS；六份探针生产输入的 SHA256 与当前工作树、包的 `source-snapshot.json` 三方一致，新增 ViewState 字段也与包内快照一致。
- 编译与包：复用上述相同输入包，manifest 的 ArkTS 与非增量构建均 PASS；本任务独立执行规范 `verify` 退出码 0、状态 PASS，见 `.reader-artifacts/bookshelf-motion-20261023/verify-hap.log`。
- 签名包：`.reader-artifacts/hap/20261023T155303Z-6b1bd753-be3ba859/entry-default-signed.hap`，SHA256 `cd6771df0b6153d901e603d72934237d76438ad7f3976068e1a8a49dafdf7332`。证书 SHA256 与指定 `minliny_HarmonyOS` 的 `3A563778E5BF17CD3EAD0218E13B4A5030DE3F5D7D4E21E0336D8EB37B676DC4` 相符。
- 非本次范围：合同门禁未选、全量 NOT_RUN；本任务未安装设备。原生 Scroll 自然测高、系统安全区像素、封面载入/交接观感、帧率和用户验收保持 OPEN。方法探针和签名包不能替代这些结果。

## 2026-10-27：CompileArkTS 入口的隐式 Native 工作（先记录）

本次需要回答的问题是 ArkTS 改动能否通过目标 SDK 的 `entry:default@CompileArkTS`；未授权把单项源码编译扩成 Native 重建或包交付。已审 `hvigorfile.ts` 的 `taskGraphResolved`：目前凡 `isBuildResourceTask`（包括 CompileArkTS）都运行 `preflightIdeNative`；该函数运行 provenance preflight，缺失/漂移时会自动执行 `Reader-Core/scripts/build-harmony-napi.sh` 并同步 Native/vendor，影响并行 WIP。锁路径当前无 owner，未启动编译或 HDC。

最小调整：识别唯一命令入口为 CompileArkTS 时，仍沿用 IDE 签名身份配置、共享 build lease 及现有打包身份检查，但不运行隐式 Native preflight；该请求若实际传递运行 Native/CMake/Ninja、清理、打包或签名 task，必须在 task beforeRun 失败，不能绕过对应检查。任何混合请求及非单项原路径不变。风险是 SDK 依赖图可能需要被阻止的 task，届时单项必须报失败，不自行扩范围。必要验证仅添加并执行一个精确 hook probe，使用生产分类与 hook 选择函数检查单项、混合/未知输入、嵌套 Native/打包拒绝、签名配置及 lease 仍被调用；不执行旧测试集合、实际编译或 Native。随后如集成稳定，再由主任务显式决定实际 CompileArkTS。

实现与验证：`reader-hap-guard.cjs` 新增精确单项识别及传递 Native/清理/打包/签名禁止检查；`hvigorfile.ts` 仍先走签名身份配置和原共享 lease，单项跳过 Native preflight，所有其他/混合命令保留原 preflight；每个实际执行 task 在 beforeRun 检查单项范围。`node tools/test-arkts-only-admission.mjs` **PASS**：使用实际 guard 分类和实际 hvigorfile 注册的 hook、受控签名/lease seam，验证单项不触发 Native preflight、传递 Native 被拒、打包仍需要签名配置/lease/preflight 并释放。该探针不调用 Hvigor、编译器或设备；实际 SDK 任务图和编译仍待主任务执行确认。

实际 SDK 入口发现：受共享 lease 限定的 `entry:default@CompileArkTS` 未被当前 Hvigor 识别，随后只读 `tasks` 仅列 `help` / `sync`；没有 ArkTS 编译成功证据。下一步只尝试 `default@CompileArkTS` 原生任务名，同样持有共享 lease 且禁止隐式 Native/打包；找不到任务或任务图不符即记录失败，不扩大范围。

后续在共享 lease 下执行 `default@CompileArkTS --mode module -p product=default -p module=entry@default -p buildMode=debug --no-daemon`，exit 0；`.hvigor/outputs/build-logs/build.log` 记录 `Finished :entry:default@CompileArkTS... after 29 s 632 ms` 与 `BUILD SUCCESSFUL in 31 s 888 ms`。Hvigor 执行了 PreBuild、模块信息、profile、资源和 loader 等前置，未执行 Native、HAP 打包或设备操作；共享锁正常释放。输出包含大量 warnings（含 SearchPage `@ObjectLink` 警告），没有进行 warning 基线差分。未在执行前建立全源码冻结指纹，结果限该次运行时源码，不推断后续变化、签装或设备验收。


## 2026-10-30：执行冻结的整窗纸面与真反向方案

基线：main `fce869a1` 加现有 dirty WIP；本次只改 MotionSpec、BookshelfNavigationMotion/Transition、BookshelfPage、Index、两个开书探针和单个显式几何合同项，保留 LocalReadingExperience 及动画工作树。此前页面矩形/780ms 的方法结果不覆盖本轮 660ms 整窗与反向状态机，需重新回答：同一时间轴能否连续反向、正文/书架输入及退出身份是否正确、新原点不可用或迟到时是否可靠降级。

执行前已读 `GATE_INDEX.md`，本次必要验证范围固定如下，所有入口均无 HDC、网络、存储业务、Native/HAP 构建或其他测试套件：

1. `node tools/test-book-opening-timeline.mjs`：SDK AST 提取实际 Transition 方法，导入实际 MotionTimeline/矩形 helper，以受控帧和平台曲线接口验证 260/260/140 的分段端点、100/300/600ms 反向的姿态与 reader opacity 连续、旧帧失效、重复反向、fade/reduceMotion、covered 握手、取消及主题/阴影/字号状态。只测试本次改动的 actor 风险；每次进程上限 30 秒，失败停止并定位，不扩范围。
2. `node tools/test-book-opening-index.mjs`：SDK AST 提取实际 Index/BookshelfPage 相关方法，使用受控 UI 测量、runtime/store 和导航端口验证整窗坐标、主题快照/异常回退、返回拦截与反向会话收尾、原点不可用回报/去重、120ms 回报接受、150ms 截止、旧 id/generation 拒绝和输入禁用接线。删除旧页面矩形测量/回填断言，不执行历史 handoff 套件。每次上限 30 秒，失败先审生产调用链和夹具。
3. `node scripts/check-header-geometry.mjs --checks bookshelf-opening-geometry-and-clock --rationale '整窗纸面与真反向改动，需要核验唯一目标矩形和时间轴接线' --json`：只执行改动的静态几何合同项；其他项 NOT_RUN。脚本顶层只读现有源文件，不调用其他检查。上限 30 秒。
4. `git diff --check -- <本次文件>`：仅补丁空白检查，无嵌套操作。

源码核对发现两个冻结方案边界所需的补充：反向 retarget 使旧帧 generation 失效，避免重复回调链；`onSearchVisibilityChanged` 对正在反向的请求保留时间轴，否则后台清理会抢先取消。书卡点击还需同步请求守卫，以覆盖 native enabled 下一次 render 才生效的间隙。实现与检查结果另补；本节不是通过声明。

P5 按冻结方案属于需另行明确发起的可选包/设备阶段，本次不执行。编译、签名、安装、设备中间像素/帧时间及用户验收保持 NOT_RUN / OPEN。


### 2026-10-30 执行结果

P1–P4 已落地于 main `fce869a1` + dirty WIP，未提交；既有 WIP 与动画工作树保留。整窗 target、660ms 共用时钟/真反向、主题纯色、分档标题/阴影、新原点可用性和 150ms 截止、返回/书卡输入守卫均已接入；补齐后台、首帧合批、旧帧链和保留书架回调的边界。

最终 `test-book-opening-timeline.mjs` PASS（0.580s）、`test-book-opening-index.mjs` PASS（0.373s）、精确 `bookshelf-opening-geometry-and-clock` PASS（0.174s，其余 34 项 NOT_RUN）、本轮 `git diff --check` PASS。本轮无失败执行。实际方法与 SDK AST 检查不证明 ArkTS 类型检查、布局/合成或设备帧率。

详细场景、执行边界和 8 份源码/探针 SHA-256 见 [书籍封面与正文交接记录的 2026-10-30 执行结果](book-cover-handoff-20261024.md)。P5 依冻结方案未执行：编译/HAP/签名/安装/设备 NOT_RUN，原生视觉、性能和用户验收 OPEN。版本与签名配置未改。

### 2026-10-30 后续用户明确启动的 VM 交付

上段“P5未执行”保留原时点；用户随后明确要求本机VM构建签装测试。数据库46/44拒开与供给未知字段问题已完成修复及保数据交付，最终HAP为`20261030T132057Z-fce869a1-1971f2d3`。原VM上实际定位并修复了Root已接受reverse但旧forward帧先完成的终态竞争；Actor改为同步读取权威请求，ACK带实际终态方向，准确延迟Prop方法回归通过。Native同request在545ms接受Back、37ms后same-id-retarget，最终reversed=true/generation3回到书架；没有用host sleep冒充300ms。日/暖/绿/夜纸色和reduceMotion开合已有真实观察，并恢复原设置；后续仅SourceSupply变化，按实际owner复用。

以上只证明限定VM行为，精确300ms/逐帧视觉连续性、GPU帧时和真机/用户验收仍OPEN。原失败日志、阶段产物、源码指纹、当前数据后证与全部范围见[完整交付记录](book-cover-handoff-20261024.md)。
