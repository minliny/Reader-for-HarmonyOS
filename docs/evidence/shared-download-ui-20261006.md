# 小说与漫画共用下载页 UI 落地记录

## 存储管理 v2 样式更新（2026-10-07，源码与签名构建通过）

用户确认按本对话 `storage-management-demo.html` v2 落地。此次仅更新独立分支 `codex/shared-download-ui-20261006` 的存储管理 UI；旧版两项设置和靠左“立即清理”没有占用概览、保留规则及候选容量，设置和操作仍处于原 UI intent 待接线范围。原生当前源码 HEAD 为 `e16f41addd7e42b574eaa50370fe2e612ed442fc`，实际改动为未提交内容，不把此前 HAP 当作本轮产物。

新稿保存为 `docs/ui-design/shared-download/storage-demo.html`，旧整页 demo 保留。新稿明确“已下载内容”总量下的“保留下载”和“自动保存”，将自动保存设置及清理动作归为同一作用域。容量必须来自验证过的实际统计；现有书架正文 bytes 不能冒充全局本地图片/正文总占用、保留策略占用、在用保护扣除后的可清理量或设备可用空间。未知数据保留空行，不使用稿中 2.0 GB / 1.2 GB / 768 MB / 600 MB / 12.6 GB 示例；无实际可清理候选时禁用清理，不能伪造成功。

代码侧可定位的范围是 Page 的内容层级、标题、字体、间距、Footer 和清理确认，以及生成器的单一旧稿来源。沿现有 CSSOM 生成器、公开字体角色、SDK 原生 Select、主题和 HAP 流水线修复；不新增通用存储引擎或缓存策略。批次完成后统一检查既有 SharedDownload 投影/SDK/视觉三项；子任务不立即测试。随后如构建可取得锁，仅运行一次规范 iteration 构建。原生截图回答新增字体/布局实际绘制是否符合新稿；不以源码、SDK 或构建成功替代 VM/用户验收。

本轮静态审计修复了数字 Builder 闭包可能持有旧值的问题：存储行以及确认按钮使用读取当前 props 的 getter，保留真实数值 Text actor；清理动作在点击与确认时分别复核候选量及 presentation generation。确认保留存储抽屉，按新稿叠加两层遮罩；平台系统栏也使用同一 Chromium Canvas2D 合成的双层颜色，取消恢复单层，关页恢复 App。没有从允许自动清理总量推导可清理量，也没有用 UI 自行扣除/删除正在使用内容。

已完成 CSSOM 正常生成与 SVG 正常同步：旧整页 207 字段保留，存储稿新增 48 字段，共 255；新稿 SHA256 为 `20ad0e4ffee223775c402850f6d3d3d2cca399a0ffbdb62ccad634c30e0fa8e4`，另有逐字段来源和结构记录。新增 22/30/500 总量和 14/22/500 数值公共字体角色，复用现有 Medium 字体；数字使用 `tnum`，辅助行 11/18、设备空间 11/21、标签 13/21，真实 SDK Baseline Flex 负责总量基线。固定 Lucide 1.8.0 ISC 的 Trash2 增加明暗/禁用四资源，正常同步总 414 个 SVG。

子任务全部冻结后，根任务一次批次运行 `test-shared-download-ui-sdk.mjs`、`test-shared-download-ui.mjs`、`test-shared-download-visual-contract.mjs`，三项 PASS。覆盖真实 @Prop 发射、有限数值/零/缺失/无效量、同 actor 数值更新、清理候选保护、确认/取消/退休/同 identity 旧回调、明暗/双层系统栏及窄短大字分支。SDK解析 457 个生产 ETS/TS 文件、139 个组件、489 个字段绑定，相关三个实际组件转换通过。本页实际 backgroundColor 计数仍 43，私有字号/独立弹窗调用 0，不扩大历史预算。

共享 VM 当前包已被其它任务覆盖且没有三个 UI 改动合并的统一包。两已授权协调任务均已收到通知，本轮不直接覆盖当前 VM；本轮新 HAP 只作为独立源码产物，VM 和用户验收继续 OPEN。没有新主线合并、提交、下载、清理或签名材料变更。

首轮规范构建完整门禁结果为 651/652 PASS、1 FAIL，尚未进入打包，没有新 HAP。唯一失败 `test-reader-startup-content-recovery.mjs:19` 的当前原始日志在 `reader-contract-run-2GXB41`：预期仅 recovery，实际 recovery/unavailable/exit。代码定位为旧测试使用 8 ms admission 超时及后续 8 ms native ACK 超时，却等待 16 ms 后检查中间状态，恰好处于终止边界，断言依赖调度时序；生产 `ReaderStartupContentOwner` 未被本 UI 批次修改。没有跳过失败或增加生产超时。

仅修复该测试的计时方法：使用 Node 26.0.0 内置 `node:test` MockTimers 控制现有生产 setTimeout/clearTimeout，显式推进 7+1 ms 验证边界，再分别验证 ACK 缺失、关闭、重试和失效回调。原断言保留，补充到期前仍处于加载状态的断言；复用 [Node 官方 MockTimers](https://nodejs.org/api/test.html#class-mocktimers)，没有自建时钟或新增依赖。根任务只重查这个受影响测试，PASS（0.74s），随后重新进入唯一规范流水线，完整门禁不复用旧结果。失败、定位与独立回归原始记录在 `.reader-local/storage-management-v2-gate-failure.md` 和 `storage-management-v2-startup-clock-recheck.log`。

最终规范 iteration run 为 `20261007T075623Z-e16f41ad-be23d7c6`，完整合同 652/652 PASS，非增量 ArkTS/Native/资源/打包/签名通过，随后独立 `verify --manifest` PASS。签名 HAP `entry-default-signed.hap` 大小 204958211 bytes，SHA256 `5d8b6fcf4de72a181a269c30bb9a65e68fd3c12360a4815a04efba3fcf1f70ec`；指定 `minliny_HarmonyOS` 证书 `3A563778E5BF17CD3EAD0218E13B4A5030DE3F5D7D4E21E0336D8EB37B676DC4` 验证一致，Profile 为 debug。内嵌 Core NAPI SHA256 `8a59414e4c8132a15a5d84f0e2ff4863cc1473df77b2ef9996342fb08bb54a3b`，19539048 bytes，Core HEAD `2166576ff5f2091b1d921c9a018cd7c7b536fdd4` 保持 clean；Host HEAD `e16f41addd7e42b574eaa50370fe2e612ed442fc` 的任务改动仍 dirty、未提交、未合并，`acceptanceEligible:false`。

manifest 位于 `.reader-artifacts/hap/20261007T075623Z-e16f41ad-be23d7c6/manifest.json`；完整构建和独立验签日志为 `.reader-local/storage-management-v2-final-build.log`、`storage-management-v2-final-verify.log`。本证据记录不在该 run 的编译输入清单中；关闭记录不修改冻结生产源码。产物中也保留既有仓库编译警告，不能声称零警告。当前结论仅为新存储 UI 的源码/实际 SDK/签名 HAP 通过，容量统计与设置/清理后台仍沿既有待接线边界；VM 安装、原生实际视觉和用户验收均 OPEN，未对共享 VM 或用户数据执行任何写操作。

## 范围与设计来源

2026-10-06 用户授权按照当前 `shared-download-demo.html` 效果在独立 worktree 落地。基线为 HarmonyOS 主线 `e16f41addd7e42b574eaa50370fe2e612ed442fc`；分支 `codex/shared-download-ui-20261006`。该设计来自本对话逐项修订的 demo，此次授权的是 UI 实现，不代表 Figma 已归档或原生设备验收通过。

设置首页进入下载管理。默认全量书架、全部/漫画/小说、搜索、三种下载状态筛选、来源筛选与字段正反序；书籍列表执行书籍操作，章节二级页执行章节操作。更多菜单仅下载/暂停、取消下载任务、删除本地内容。2026-10-07 视觉修复改为消费已确认 demo 的独立公共视觉参数、精确下载页主题角色及可溯源 Lucide 图标；封面和业务投影继续复用现有所有者。

阅读入口仅标注小说正文阅读页或漫画图片阅读页，显示真实书籍/章节；复合 sourceId/bookId/chapterIndex/chapterId 身份只在回调中传递；`wired:false`，不打开阅读、不抓正文/图片、不写进度。下载、暂停、取消、删除、清理、存储设置只发送待接线 UI 意图，不调用后台写接口或伪造成功。已有正式下载/阅读链路仍由原有页面负责。

## 真实数据与边界

复用 `BookshelfFlowGateway.loadAll` 的同版本全量分页，不能把当前书架首屏当全部内容。缓存投影复用 `cache.book.status`、`local_book.toc`、`manga.entry.get`；漫画采用现有 Host 的精确 manifest/文件完整性校验，阅读保存的完整章节同样算已下载，永久归属不是显示完成的前提。章/卷分组不计下载章节。

部分书籍有完整本地章节也归入已下载，百分比单独按章节数量计算。读取失败与下载失败分开；未确认总数、状态和空间留空并保留行。漫画图片占用空间总量及设备剩余空间没有当前读取接口，不使用 demo 数字替代。文字字节只代表已保存正文，不代表全设备磁盘用量。音频保持书架行且类型标签留空，不冒充小说。

Host 完整性查询可能完成现有的已确认待清理意图；本页面不新增清理意图。此恢复行为来自既有文件所有者，不能把查询等同于自行实现无副作用文件扫描。

## 问题记录与最小统一验证

开发子任务不执行测试。批次结束统一验证真实生产投影/回调、状态与作用域、取消晚到发布及 SDK 组件转换，实际 VM 视觉单列。

2026-10-06 第一批：

- Node 回归入口在执行前拒绝新 Gateway 的 TypeScript constructor parameter property（strip-only mode）。源码定位：本批 Gateway/Host 应沿既有明确字段方式声明 constructor 输入，避免该兼容性差异。
- 官方 SDK 成功解析 456 个源文件、核对 503 个组件参数；Index 与 Settings 转换通过。SharedDownloadPage 返回栏 `trailing: this.headerActions` 产生 BuilderParam 警告，定位为 Builder 传递形式；改为显式 Builder 闭包后重验。
- `git diff --check` 通过。

这两处均为代码/本地验证结果；未构建 HAP、未安装 VM、未做原生视觉或用户验收。

## 最终统一验证结果

修复上述兼容性和 Builder 传参后，两项统一验证通过：

- `node tools/test-shared-download-ui.mjs`：运行真实生产投影/读取 decoder/SDK 转换的 UI 回调及 Host，覆盖已下载与比例拆分、未知状态、分组排除、图片完整性、复合书章阅读目标（待接线）、操作范围、最终滚动保存、同书刷新去重和退休后的晚到响应。
- `node tools/test-shared-download-ui-sdk.mjs`：本机官方 SDK 解析 456 个生产 TS/ETS、注册 139 个组件、核对 503 个实际属性接入，Index/Settings/SharedDownloadPage 组件转换无诊断，媒体资源存在。

验证边界是源码执行和 SDK 解析/属性接入/组件转换，不是完整项目语义编译、HAP 构建、原生绘制或设备行为。HAP、VM 视觉及用户验收保持待验证。本批修改未提交、未合并至主线；后续集成需沿已有 HAP 唯一流水线构建。

设计源精确副本保存于 `docs/ui-design/shared-download/demo.html`。已移除 demo 的伪离线阅读说明，改为当前书章的小说正文/漫画图片阅读入口标注（待接线）。

## HAP 编译请求与完整门禁问题

用户继续要求在此 worktree 编译 HAP。配上干净 Core `2166576ff5f2091b1d921c9a018cd7c7b536fdd4`、Reader-UI `8e8e7bc530d602bef2f0be61d29f197efaa1b172` 并同步治理合同。Core 的忽略 target 引用已经逐文件验证一致的 full-integration-20261005 配套；Native buildId `9459d76c301987bf367ac88c5d3d679ced0f1c47fd740c4f2c8873575de64549`。规范 sync-native 已通过，SO SHA256 `d1f88c018a906345c9f92dccb3840dfbc3a59f38980886b4062d0957f444b986`。指定用户签名通过规范 sync-signing 导入私有忽略目录，没有改变证书或应用身份。

第一次 iteration HAP 流水线在完整合同门禁停止，没有产生 HAP。失败日志保存于私有 `.reader-local/shared-download-hap-build.log`，整批收齐后确认 6 项：

- 两项架构检查均指出新 SharedDownloadPage 没有 uiPolicies 登记。正常补充精确业务页登记、用户批准 demo 来源及真实 AST 计数；不改历史预算、不伪装通用 producer。
- 字体检查指出新页直接写字号/行高/字体。需要消费公共 ReaderTypography 精确语义角色，保留已确认元组和 AUTO 字段；不新增私有字体额度或放宽检查。
- 图标检查指出 SVG 使用 Image.fillColor。改用来源可追溯的固定 day/night 资源，不运行时重着色。
- Native 默认控制检查指出无文字的 Button({type}) 事件宿主被计为未登记字形。按原生无文字槽位方式声明，实际 Text 子节点使用公共字体角色，不加虚假 TYPE 修饰。
- 主题前景检查的历史站点枚举不能执行新页依赖 id/book 的原始色值表达式。有限状态颜色由实际语义 helper 处理，并由新页的 Day/Night 回调证据验证；不改原先的 31 个历史前景证明。

以上均已从源码/合同定位。整批结束后集中修复，再统一运行相关回归与完整 HAP 流水线；不在每个子任务完成后运行测试。

集中修复后的相关门禁已通过字体、固定图标、原生默认控制、历史主题前景及 SDK 组件转换。新增日夜主题回调探针第一次运行缺少 Node 测试环境的 ButtonType/TextAlign 平台枚举，定位为探针入口而非生产页面，补齐平台端口后重验；不改变实际字体、颜色或页面回调。

## 本 worktree 的 HAP 编译结果

2026-10-06 完整第二轮流水线通过：`READER_CONTRACT_TEST_WORKERS=4 node scripts/hap-pipeline.mjs build --class iteration`。651 项 Host 合同测试全部通过；ArkTS 类型检查及完整非增量编译、打包、签名、Native 来源和内置书源字节校验均通过。独立的规范 `verify --manifest` 再次返回 PASS。

- runId：`20261006T153252Z-e16f41ad-3b4549d9`。
- 构建清单：`.reader-artifacts/hap/20261006T153252Z-e16f41ad-3b4549d9/manifest.json`。
- 签名包：同目录 `entry-default-signed.hap`，204,683,915 字节；SHA256 `6dd6d070be4e69d6cd5e27a9f0113e59e48a840536323cb231a6f08515482733`。
- 证书：用户指定的 `minliny_HarmonyOS`；包内证书 SHA256 `3A563778E5BF17CD3EAD0218E13B4A5030DE3F5D7D4E21E0336D8EB37B676DC4`，Profile 类型 `debug`，签名校验通过。
- Host：`e16f41addd7e42b574eaa50370fe2e612ed442fc`，含本批未提交 UI；Core：`2166576ff5f2091b1d921c9a018cd7c7b536fdd4`，干净。构建输入指纹 `3b4549d94ae9ad848fe23ec781881ee5ac830da0694690aa8843e48a6bc7cc09`。
- 首轮失败日志：私有 `.reader-local/shared-download-hap-build-attempt1.log`；成功日志：私有 `.reader-local/shared-download-hap-build.log`。首轮 6 项失败已按整批修复后统一验证，没有绕过门禁。

编译器仍报告既有诊断/页面的警告，例如 ArkWebResourceDiagnostic 的 WebResourceResponse 名称、弃用 API 和 SearchPage 的 ObjectLink 赋值；日志没有本批 SharedDownloadPage/Host/Gateway/Projection 的编译警告。没有将编译通过表述为无警告或运行验证通过。

交付层为签名 iteration HAP，`acceptanceEligible:false`。未安装或启动 VM/真机，未做原生视觉或用户验收，未提交或合并。阅读入口及下载/暂停/取消/删除等写操作仍保持用户指定的待接线 UI 意图；入口是设置 → 下载管理。

## 2026-10-07 全量视觉一致修复批次

用户要求以已确认 demo 为唯一视觉依据，补齐可确定的一致性并保留自适应。审计定位到源码直接分叉：搜索 44/13 被旧组件替为 36/胶囊、页签 36/13/500 被替为 32/12/400、标签 10/16/深色底被替为9/AUTO/浅色底、书名和作者被单行裁切、封面固定80、上下15间距改13；抽屉、遮罩、拉手、阴影和下拉选项结构也各自另定。编译通过不能关闭这些缺口。

开发分工已冻结：一名子任务只改 SharedDownloadPage，另一名只改三处公共字体所有者，第三名只准备新的真实 Builder 回归，子任务不运行测试。根任务负责 demo→有限视觉定义、主题/图标生成及公共探针真实依赖。先整批修复，后统一最小回归与必要完整编译。

视觉提取采用项目已有 Playwright/Chromium 的 CSSOM，不自研 CSS 解析或排版引擎。首轮生产生成发现 gap 被 CSSOM展开成row-gap/column-gap，补读取复合属性；第二处 border shorthand包含var()，CSSOM延迟长属性，须由 Chromium 实际解析 border-top-width。两项均是代码侧提取入口问题，未进入原生运行或测试阶段。公共 ReaderTypography 新增真实 DOWNLOAD_VISUAL 依赖，既有求值探针应正常注入生产模块，不能另复制字体元组或放宽旧断言。

当前待证：同字库身份与字重、原生文本基线/行高、真实窗口短屏/大字体下抽屉空间及阴影合成。源码数值可统一；Native 实际绘制需要绑定新包后最小对照，不能拿旧 HAP 或 Builder 属性作为该层 PASS。

代码批次收束：Chromium probe 补入真实 phone 的 CSS 变量上下文后，border width 精确为 1；生成 198 个有限视觉字段。12 个下载页 day/night 色彩角色进入正常主题注册表，未改历史色彩角色。16 组图标来自固定 Lucide 1.8.0 图形及 ISC 许可证，正常 SVG 来源流水线生成 410 个可信资源并保留旧资源来源约束。无运行时 SVG 重着色。

自适应代码复核发现两个确定问题并修复：短窗时 sheet/main 的固定标题和底栏可超过可用高度，改为仅在空间不足时整块滚动；字体准入前的滚动恢复与同 identity 重入的晚到回执可能影响新页面，改为 fontsReady、mount identity、generation 三重围栏。封面跟随自然文字测量，保留 80 下限，扩大字体或换窄窗后可增长，条件恢复时可缩回；重复测量回执不反复发布。

字体固定使用已存在的 400/500/600/700 静态字重，并在展示前校验五个实际字体注册成功。`fonts.json` 记录字库身份和比较边界：本地 Sans 与 demo Google 字库同属 2.004，但 outline 格式与少量采样边界存在差异；12 个采样字 advance 一致，不能推论全部字形或 native raster 像素相同。未更改原始 demo 来掩盖该差异。

范围缺口：demo 自身的 renderSheet 没有 range 分支，保留已有范围选择薄适配，不能记为已确认截图还原。章节快速选择使用 demo 的行内 Select；已删除多余的独立快速选择面板。其余常规窗口的列表、章节、筛选、排序、空间、书章菜单、阅读目标和确认状态均以同一 demo 为视觉依据。

最终短窗复核再修复确认框：按钮与内外 padding 大于窗口时，正文 clamp 到零仍会溢出。此时改为整份确认内容滚动并让外部竖向留白退让；常规布局保持原来 24 外边距、内部间距和按钮。键盘沿 SDK 默认 OFFSET，未再次扣键盘高度；实际测量 pageHeight 优先，未推测覆盖系统模式。字号与行高的数字单位均已从本机 SDK 的 fp 契约确认。

统一最小验证：三 worker 一批执行 10 项，新视觉、原有下载业务、SDK转换、架构登记、字体注册/覆盖、图标、默认控制、SVG来源与主题前景。9 项首轮 PASS，新视觉探针在 compact 分支发现测试入口缺口：SDK build 已转为 initialRender；ListItem 内容由真实 lazy callback 延迟创建，探针未准入该回调及其 ViewStackProcessor 平台端口。按现有书架探针方式补齐真实 SDK 回调后，新视觉回归 PASS，未改变生产页面来绕过断言。三次失败日志均保留。生产 CSSOM generator --check 与 git diff --check 通过。

这批验证覆盖 demo SHA、所有生成字段及来源、日夜色值、真实 SDK Builder 属性、筛选回调、封面 137→80 缩回及测量去重、字体晚到/generation/idle-frame围栏、主页面/sheet/dialog 的极短窗降级。原生排版、像素、手势和键盘运行表现仍需要新产物的独立 VM 证据。

第一轮完整流水线在合同阶段发现旧 fixture 的直接字体求值缺少 DOWNLOAD_VISUAL 依赖。只读全面定位为 10 个测试和 1 个公共 chrome helper，均复用既有实际源码字体加载器，原角色/旧元组断言及变更源码负控不变。确认同源影响范围后停止本任务必然失败的 gate 及其子进程，HAP 父进程完成清理；此轮是 cancelled/failed，没有产物和完整门禁 PASS。部分日志仍保留于 `.reader-local/shared-download-fidelity-build-20261007.log`。

额外代码复核确认反应性缺口：StorageLink 的窗口 revision 仅声明而未在 render 消费，plain Coordinator 快照读取不会建立该依赖。新增 currentMetrics 显式读该观察属性，九个 helper 的十一处读取改走同一入口。真实 SDK 编译 getter 与已安装 SDK 观察属性实现的回归已证明：仅发布 revision，保留的 header 安全边距从16更新至32/26，搜索框高度从42更新至60；observer数量不增加，不靠手工重建页面冒充动态通知。

集中修复后统一执行18项相关回归，17项首次PASS，新视觉回归仅因测试错误把header横边距16写成竖间距10而失败；修正该测试预期后PASS。该轮涵盖前述11处fixture、chrome helper的4个额外消费者、源码增添role负控、SDK与架构登记。接着重新进入唯一完整 HAP 流水线，不复用上轮 gate 结果。

浏览器参考4状态已存于私有 `.reader-local/shared-download-visual-reference/`，原 demo SHA 保持不变，Google Fonts加载且CDP确认custom Noto，Lucide宿主用现成1.8.0并记录版本边界。phone名义内容盒365.714×809.143、DPR3.5；浏览器布局量化和截图clip行为使内容盒PNG实际1278×2832，整phone为1288×2842。无源码改宽或图像缩放，不能伪称1280截图。参考取证本身不是Native验收。

用户明确授权与两个界面任务协调下载页优先的VM时段；两任务报告本地开发、未持有目标并暂缓安装/UI操作。待新包PASS后使用目标127.0.0.1:5555，保留应用数据，不卸载清空。

排队期间的最后源对照补齐滚动条语义：demo主列表明确scrollbar-width:thin，overflow可滚，旧Native却强制Off。浏览器thin/auto/initial实测均overlay占宽0、颜色auto，没有作者给定像素宽/颜色。主列表和有溢出的面板改为Native Auto；颜色、像素宽和退隐时机仍属平台默认边界，不虚构精确token。源码输入在下一轮规范构建开始前冻结。

构建席位：修复后的首次重跑因另一个独立worktree正常持有全局HAP锁而在入口退出，没有门禁或产物。已由用户授权协调下一轮优先，等待锁正常释放，不移除他人锁。VM预检已读取真实1280×2832窗口，当前是系统锁屏；Reader-bundle过滤树为空与前台状态一致，不认定VM故障。

最后整批源对照修正已完成：书名旁的13图标恢复跟随文字（gap 4，正文可收缩但不扩展占满）；列表数量恢复“可见 / 全部 本书”；章节操作独立tail gap 2、更多30×44，书籍更多28×24；“立即清理”按内容宽度；次级摘要真实失败用红色；确认框保留原稿书/章作用域数量及完整原文案；书籍管理态禁用状态操作并保留0.5透明度；只有真实inProgress章节标题变绿。新增三项章节尺寸后，CSSOM生成定义为201字段，原稿SHA不变。架构登记只更新本新页实际backgroundColor数量42→43，公共字体调用188、private为0，不改变历史预算。

真实章节副行已接入既有元数据/完整性端口：小说完整正文显示“正文已保存 · 已下载”；漫画总页数仅来自校验过身份和版本的entry.chapter.totalPages，不能采用最多32页的manifest窗口长度。整章完整性为true时已保存数量等于总页数；false不能得出零页，部分保存计数保持空白。目前未增加新RPC、磁盘扫描器或缓存实现。

第二轮排队后启动的完整门禁因上述确定源差异尚未进入冻结状态而停止了本任务的gate子进程，HAP父进程正常清理；日志保留于 `.reader-local/shared-download-fidelity-build-20261007-final.log`，结果为cancelled/failed，无新HAP。协调任务继续保持下载优先构建及VM时段。

最终开发批次统一10项检查首轮9 PASS；原下载业务测试因新增页数样本共用调用记录而将两个追加cache.book.status调用算进旧断言。原断言移至原样本边界，业务预期不变，单项重跑PASS。其余9项不重复执行。CSSOM generator --check确认201字段及12角色，git diff --check通过。浏览器启动在沙箱中被macOS MachPort权限阻止，按既有授权在沙箱外执行后通过，未记为VM问题。新包完整652项合同门禁、ArkTS编译和VM实际绘制仍待本轮规范流水线证据。

本轮VM最小取证范围：安装绑定本轮源输入/证书/产物的signed HAP，保留数据；从设置进入下载管理，查看已有书架数据的主列表、书籍菜单、筛选、章节次页与确认框，验证字体/字重、行高、间距、拉手/关闭图标、遮罩和阴影的真实绘制。短窗、大字体及键盘只覆盖可通过目标正常UI设置获得的状态。代码/SDK已经定位并修复的布局反应性不再重复用VM排查；原生栅格化和实际测量为代码侧剩余未决点。原稿范围选择没有完整设计分支、部分保存页数没有真实计数，仍保留各自边界。

本批新包规范构建通过：652合同全PASS，ArkTS/非增量编译/签名通过；runId `20261007T035027Z-e16f41ad-3610a684`，signed 204871534字节，SHA256 `29f0c9b500e67af3d37706e8b393fc0fabd31897a971d45e7ac2bc96af49c747`，证书仍为指定minliny_HarmonyOS。独立verify PASS、VM inspect为身份匹配保数据路线，install receipt `deploy-vm-6460677a198b-20261007T035132Z.json`返回dataPreserved:true。此包为iteration、未提交/合并。

实际原生截图已发现下一批确定缺口，不能将本包记为视觉验收通过：day-books及day-book-more保存在私有 `.reader-local/shared-download-native/`，各自含PNG/真实UITest树/manifest哈希收据。触发为设置→下载管理→第一书更多，目标1280×2832、两本现有斗破苍穹（小说/漫画）。筛选/最近阅读Text仍为muted，原稿应为ink；menuAction虽borderRadius(0)，默认Capsule类型仍使分隔线末端弧化；Index安全区与系统栏opaque背景让scrim仅从y137覆盖，需复用单一Coordinator成对调整/恢复overlay chrome。Book ForEach稳定key闭包疑似保留初始unloaded DTO，主列表下载副行持续空，但当前菜单三项enabled:true且actionAvailable对非ready均false，证明当前Host已ready；真实Core参数已核对完全一致。修正应复用LocalImport现有getter模式，让保留的SDK observer读取当前books，而非改key重建整页。

正常边界分别记录：混合列表漫画空间未知使底栏总空间留空、设备可用空间留空；这不解释ready章节副行空白。表面颜色Native PNG为FEFCF8、browser为FFFCF8，实际Native dump和生成源值均FFFFFCF8，是1级合成/截图量化边界，不能反向改色token追图；paper/green/line平坦实像值匹配，day scrim合成paper实像值A3A19B也匹配。系统栏合成色须仍源自demo的paper与scrim。

下一批先全量开发后统一最小验证：三个共享下载回归含真实SDK同key对象替换/失败恢复/同key章节更新及旧闭包负控、Normal按钮构造；Coordinator overlay成对恢复与晚到围栏；相关字体/架构/Native默认控制/主题/SVG门禁；CSSOM来源校验。子任务只准备代码/断言，不单独跑测试。全部修复完成后一次统一检查，再按同一规范完整HAP，不复用先前652结果。

原生修正批次已收束：Stable key保持，复用LocalImport的getter使每个真实SDK observer读当前books/chapters，衍生primitive同样按getter消费；事件按mount/identity/generation与当前数据存在性拒绝旧目标。全页Button显式Normal，Native默认字体审计按真实SDK AST识别仅Normal选项+Text子节点的无字形wrapper，带label或未知字段负控仍不准入。两工具及章节工具栏颜色按原CSS继承修正。

系统栏仍复用单一Coordinator：CSSOM/Canvas2D生成scrim与paper/ink的合成角色，Day A3A19B/14110F、Night 0E0F0D/75736F；sheet导航带用surface/ink，dialog用合成色。Coordinator只添加可选导航色及相同语义的去重，旧调用未提供时保持原行为。Page Watch微任务合并，退休先废代再恢复AppChrome，晚到不复写新页面。

补查day-filter及day-storage发现Native Select闭合高度174px（49.7vp），源码padding叠加NORMAL默认高度。所有6处继续使用原生Select/menu/onSelect，通过现成TextModifier和SymbolGlyphModifier配置完整字体与真实系统chevron_down（SDK资源125832666、HMSymbol cmap F00DB的空心V），使用SMALL及显式高度。SDK base small minimum28、TV36；目标VM私有主题仍以新包原生bounds为准。选项宽度复用MeasureUtils按当前值及全部选项实测，fp原样传入、px2vp回收，加入显式箭头slot/原生8gap/padding并限制窗口可用宽，未估字符宽、未重写picker。

生成器已载入原稿原Google Noto链接并确认实际FontFace loaded；只读取原稿内联CSSOM，避免跨域Google样式表cssRules访问。此前fallback测量得到settings30，与真实字体31不同，不能采用；源证据保留。最终207字段、14色角色：settings closed31，quick继承11字号/实际内容行盒18/closed28，arrow slot20。快速选择采用独立公共11/18/400角色及muted，范围薄适配保持39。箭头以12vp固定，避免系统字体缩放再扩大图标槽位。架构库存当前共享字体188、private0、backgroundColor43，历史预算不改变。待整批统一验证及新HAP/原生复验。

原生修正统一14项批次：9 PASS、5失败，完整日志保留于 `.reader-local/shared-download-native-fix-batch/`。失败依次为章节样本使用非规范key导致阅读契约拒绝、SDK转换后原DSL AST扫描方式不匹配、旧系统栏源码契约未覆盖可选导航色、TextModifier别名未被公共字体审计识别、固定箭头单位表达式未走公共字体角色。生产改为直接公共角色分支，并对公有尺寸无参toString+vp的精确AST转换准入，私有/混合加1负控保持拒绝；历史私有预算不放宽。五项集中重跑中系统栏/字体覆盖/架构库存 PASS，两个新SDK回归继续处理AST形态和Watch注册语义，不能记为全绿或启动新包。

统一修正结果：原生修复批次14项最终全部PASS。五项仅集中重跑失败项；章节样本改为实际canonical key并保留阅读目标/旧事件负控；SDK原始DSL使用EtsComponentExpression，lowered类遵循真实emitter的visitEachChild过滤 omitted 节点；实际Watch登记/SDK scalar notify均正确，失败根因为测试提取ReaderWindowChromeStyle遗漏真实findReaderTheme依赖，已注入生产函数，未改通知运行时或绕过Watch。最终日志在 `.reader-local/shared-download-native-fix-last/`；SDK解析457文件、489真实组件绑定、Normal/6 Select lowering及getter参数签名PASS，字体覆盖/架构库存 private0。生成器上一检查207字段/14角色PASS；本批未更改其源/生成输出。现在冻结生产与测试输入，进入新的规范全量iteration HAP；上一包原生失败仍保留。

新的完整652门禁批次649 PASS/3 FAIL，未进入编译发布，无新HAP。完整日志 `.reader-local/shared-download-fidelity-native-fix-build.log`，失败原始日志目录reader-contract-run-qhwvJu：layout-architecture保留旧导航色源码断言；directory-fixture是sandbox listen EPERM（非VM问题，夹具源码不改）；SVG provenance仍绑定新增2色角色之前的主题注册表哈希（资源色值未变化，必须正常sync-svg-assets更新来源）。补齐相关契约及生成来源，下一次规范构建按用户已有绕开沙箱授权在沙箱外执行，保留完整门禁。

失败项统一修补/在沙箱外复验3/3 PASS：layout-architecture 0.15s、真实Core目录HTTP夹具0.92s、410 SVG来源检查2.03s，日志 `.reader-local/shared-download-native-fix-gate-repair/`。未降低断言、未跳过夹具或放宽SVG来源；只更新导航可选值+原回退的完整源码契约及正常生成清单。生产/测试再次冻结，新的canonical iteration build将在沙箱外从完整652门禁开始，首轮失败不会复用为构建准入。

新规范包652/652 PASS、非增量ArkTS/打包签名通过（1m262ms），run `20261007T051007Z-e16f41ad-5d8c9379` signed SHA49155615d9c0ec45a93be34dd236b7d4bec024fdfe22510458af5c0f2fe6bb6b；独立verify/inspect PASS，install receipt deploy-vm-6460677a198b-20261007T051102Z.json dataPreserved:true。实际VM final-day-books→final-day-book-more→取消dialog→final-day-books-ready已证明同key加载状态自然更新，小说4/1663下载失败、漫画5/681已下载；原生Normal按钮直线分隔与status/nav遮罩合成/关闭恢复已改善。未执行下载或删除。
Native final-day-filter两Select bounds高109px（31vp，1px量化），系统V可见，但闭合值文字看起来比13fp左侧标签更大，第一项全部状态截断为全部…。需继续源侧查平台modifier应用顺序/语义，不能记为全量视觉一致通过；本批截图与实际树/manifest收据均保留。

源侧定位Select字体偏差：上游 SelectPattern::SetControlSize→ResetParams 无条件 SetFontSize(selectTheme->GetFontSize(controlSize_))，覆盖同一内部TextLayoutProperty（select_pattern.cpp 2583、2616–2622、1078–1090）。本机实际像素左label ink高41px、选中值45px，与13fp→SMALL默认14fp一致；量测宽仍13fp因此全部状态被截断。最小修正仅6处controlSize移到font/textModifier/arrowModifier之前，显式字体和箭头最后应用，保持所有既有字段/测宽/原生menu。SDK emission新增真实顺序断言及旧顺序负控；开发收束后统一3下载回归，再完整规范签名build。Native chapter/details、确认框截图已记录，未执行任何下载/删除。

Select顺序修正批次统一3/3 PASS（UI 1.72s、实际SDK/Prop视觉契约2.13s、SDK emission顺序/旧顺序负控3.04s），日志 `.reader-local/shared-download-select-order-batch/`；六处原生menu/onSelect/完整TextModifier/SymbolGlyphModifier保留，生成207字段及14角色不变。官方覆盖路径 https://github.com/openharmony/arkui_ace_engine/blob/master/frameworks/core/components_ng/pattern/select/select_pattern.cpp 。冻结此批输入，最后重建新iteration HAP以确认目标VM字号与完整值，不以旧包声明修复。

新增运行现象待定位：当前49155615包章节管理页经Header返回连点3次，再点击通用设置坐标，final-general-day实际抓到Launcher，Reader pidof为空。此前源码back()/consumeBack与Index returnToSettings已核对：管理→章节→书籍→设置顺序，UI脚本未逐步抓树，不能直接归因为稳定Crash。接下来先只读faultlog/hilog判断是否存在本应用退出原因；如无证据，仅按用户已有偶发不稳定阻塞处理规则做最小逐步复验，不扩大无关调查，不称VM异常。

返回页现象已由真实Hiview JS堆栈定位为本应用确定Crash：publishViewState:1395 Cannot read property yOffset of undefined，detailKey setter→同步Watch→consumeBack。在章节→书籍的同帧，主List未重新绑定，Scroller.currentOffset()可为undefined。原始faultlog私有 nav-return-jscrash.log（13:21:34，49155615当前包），非VM异常。已停止本任务尚在门禁阶段的52393/52567构建，父进程正常退出无新产物；另一个10817合同进程未触碰。最小源码修复两读点统一捕获仅有效finite offset；undefined/NaN/退役异常保留原listOffset，原post-frame恢复围栏保持。真实SDK detailKey Watch回归增加三个空绑定边界、有效position及原yOffset直接解引用负控。此确定缺陷需与Select修正合批后重新构建。

Scroller+Select最终开发批次统一3/3 PASS：UI 1.77s、actualSDK/Watch合同2.46s、SDK顺序/Lowering3.31s，日志 `.reader-local/shared-download-scroller-select-batch/`。detailKey Watch实际同步送达，三种未绑定边界均保留73 offset，原post-frame onIdle恢复73，有效native126写入126；恢复旧直接yOffset路径时同一回归抛TypeError负控成立。无需再用旧包反复触发Crash。冻结最后此批输入，完整canonical build/新包安装后只复验已定位修复与原生绘制未决点。

## 最终结果（2026-10-07）

最终 iteration run：20261007T053655Z-e16f41ad-8bce749b。完整652/652门禁、非增量编译和签名PASS；signed 204916330字节，SHA47e56965f6d681d400bb26ff4a0473e53c295fd04a8b714ff26e4fff967dc106。指定minliny_HarmonyOS证书不变。独立verify/inspect/install PASS，deploy-vm-6460677a198b-20261007T053825Z.json确认dataPreserved:true。未提交/合并，acceptanceEligible:false。

最终原生证据索引：.reader-local/shared-download-native/final-state-index.json，包含PNG、UITest树、manifest哈希；accepted前缀只是复验文件标识，userAccepted:false。日夜Select均为109px/31vp，全部状态完整显示，13fp文字与标签一致；快速选择98px/28vp、11fp。管理→章节→书籍→设置逐步返回通过，旧yOffset崩溃已在新包关闭，4/1663及5/681内容保留。日间菜单、确认框、遮罩、系统栏合成及取消恢复均有最终包截图；最后回日间主列表，PID2050正常。

主题原状态经真实selected属性确认为跟随，临时夜间后已恢复跟随。未执行下载、暂停、取消任务、删除内容或清理。两授权任务已收到明确VM释放通知。

自适应代码/实际SDK覆盖窗口revision、窄窗/短窗/大字体、自然换行及封面伸缩、超短窗整块滚动。原生证据覆盖1280×2832；搜索框focused:true，但此次软键盘未显示，键盘缩区原生证据未取得，不记PASS，不归因VM故障。

平台边界：真实系统安全区/图标/emoji、字体抗锯齿及单RGB级合成量化、原生滚动条和选择控件UA绘制。原稿checkbox仅声明17尺寸/green accent，无appearance/shape定义，保留原生控件，不宣称UA逐像素相同。原稿range没有设计分支，该薄适配不列为已确认设计稿；阅读和下载写操作仍只标注意图，未正式接线。

## 存储管理 v2 VM 安装验证开始（2026-10-07）

用户明确要求安装验证。目标现场确认为运行中的 Mate 80 Pro，实例 `/Users/minliny/.Huawei/Emulator/deployed/Mate 80 Pro`，1280×2832 px / 560 density；当前 HDC server 8710 下唯一 target 127.0.0.1:5555。Guest boot completed=true，Emulator 当前实例日志含 Guest OS Boot Completed。安装前记录保存在私有 storage-management-v2-vm-preflight.json。换源任务已确认释放；等待漫画目录任务确认后保数据安装本节 v2 immutable manifest。

最小原生取证仅回答代码/SDK 无法证明的实际字体、原生 Select、间距、系统栏及明暗绘制：打开存储管理、核查未知容量保留行且清理禁用、设置选择/关闭/返回/重开、日夜截图，最后恢复原始外观设置。已审计所有这些生产源码及官方 SDK 属性；容量后端/已知容量启用清理场景未接线，不注入假统计、不执行删除。此安装会覆盖 VM 先前漫画目录候选，仍不含两个并行任务新增 UI；不能作为其回归结论。

### 本轮 VM 发现与代码定位

v2 首次保数据安装/启动 PASS，部署回执 deploy-vm-6460677a198b-20261007T094726Z.json 绑定 SHA 5d8b6fcf…，当前存储 unknown 绘制截图 storage-v2-day。两项实际绘制未通过：STORAGE-V2-NATIVE-01，禁用清理按钮被平台再次淡化，实际背景 #f8f6f0 / 字形主色 #c7c4bf，批准稿要求 #f0ece3 / #756f69；已查上游 ButtonPattern::HandleEnabled 的 disabledAlpha乘法，opacity1不能覆盖该处理。STORAGE-V2-NATIVE-02，原生空Text baseline使summary高44.57vp、左标签下移23.43vp；批准稿unknown的真实CSSOM高35、下移14，测量文件 unknown-metrics.json，不能以正常有数字样本替代此状态。源码批次修复后统一已有三项回归，再规范构建；修复完成前视觉保持FAIL。

已核查Select308×109px≈88×31vp、50vp设置行、footer44vp及28vp系统安全区底边均符合批准默认样式。选择上限1GB与14天后关闭重开回显，disabledButton不可用，系统返回正常恢复下载列表；这仅为该页局部UI状态，不表示后端持久化或清理接线通过。

禁用淡化的上游定位依据：[OpenHarmony ButtonPattern::HandleEnabled](https://github.com/openharmony/arkui_ace_engine/blob/master/frameworks/core/components_ng/pattern/button/button_pattern.cpp#L1378)。该资料只解释平台路径，当前问题是否修复仍以同一产物的原生截图为准。首包深色截图已保存 storage-v2-night，原始主题“跟随”恢复并以选中Stack状态确认，不执行自动清理或永久删除。

### 原生差异修复批次冻结

两项修复已同批冻结，并经另一agent只读复核，无子任务立即测试。清理像素由不接受点击的视觉Row绘制，真实透明Button仍持有 disabled、无障碍文字及原有候选/世代保护；使用SDK API15 width/height(LayoutPolicy.matchParent)跟随内容最终尺寸，目标API23，不设固定高度或改enabledtrue伪装禁用。新增的唯一透明背景站点属必要平台适配，实际backgroundColor为44并登记真实来源；原100页及历史共享预算未改。unknown总量保留原数值Text，以CSSOM实际测出的35/14和fontScale适配空文本fallback基线，已知容量包括0仍Baseline。批准HTML SHA未改，正常生成257字段。生成首次仅因Chromium沙箱MachPort权限失败，现已在用户授权的外部权限正常写回；没有将其归因VM。

本批只启动一次规范iteration流水线，相关三项检查随完整门禁统一执行，不先重复单跑。原生复验将绑定新run和新的安装回执，首包FAIL证据保留。

修复批次首轮完整门禁651/652 PASS，未进入打包。唯一FAIL为新增visual-contract:622实际70、预期35；源码定位不是生产缩放错误，而是545行前一个reactive字体用例将windowMetrics.systemFontScale设2、直到689才恢复，污染独立基础存储用例。补上一行在该字体用例末恢复originalWindowMetrics，保留35/14严格断言、2倍字号断言和生产实现不变，不增容差不跳测。原始reader-contract-run-U5U5My日志及定位已记录storage-management-v2-native-fix-gate-failure.json。整批收齐后冻结这一项测试夹具修复，再规范完整构建。

### 最终CSS级联对照发现（STORAGE-V2-NATIVE-03）

修正包20261007T101943Z-e16f41ad-fc000415签名HAP646a79bf…，完整652/652与独立verify、保数据install/launch均PASS。unknown几何35.14/14和真实disabled语义已原生闭环；声明色soft/muted也绘制正确，但再次同态截图审阅发现当前HTML实际禁用按钮仍0.5透明度：.phone button:disabled 的特异性高于 .clean-button:disabled 的opacity1。此前生成器取后者单条声明，漏掉最终级联，因此不能声明该按钮已与实际approved reference全量一致。按用户唯一demo依据选择不修改批准HTML/SHA，修正生成器读取真实disabled DOM computed opacity，原生视觉Row仅在禁用时应用，已知可清理状态保持1；SDK/几何PASS与此级联FAIL分开记录。主题在本阶段结束已恢复跟随。

第三项修复保持设计SHA不变，生成器已读真实disabled DOM computed opacity0.5，来源记录标明完整CSS级联。SDK代码侧同时确认 common.d.ts renderGroup 默认false且会影响半透明组件/子内容混合，与CSS组透明需做有限适配；仅给这一个44vp视觉Row启用renderGroup(true)，不冻结内容、不改事件Button。刚启动的早期第三批检查仅本任务PGID6801已通过cwd/命令验证后主动SIGINT取消（不是失败门禁、没有产物），补齐此适配再冻结，未继续已知不完整包。最终统一pipeline日志storage-management-v2-computed-opacity-build-final.log，仍不单跑子任务测试；原生取证依据将使用approved reference实际computed0.5及Chromium Canvas混合结果，而不是低优先级声明色。

## 存储管理 v2 最终 VM 结果（2026-10-07）

最终实际CSS级联包 20261007T104123Z-e16f41ad-bbb61ae6：签名HAP SHA256 `87639a7dcd3302e3da79c146f175cea6d7b77b5d8b1e1321501b373e230cdbb0`，指定证书不变，完整652/652、非增量构建、独立verify PASS；manifest绑定保数据install/launch PASS，部署回执 `.reader-artifacts/hap/20261007T104123Z-e16f41ad-bbb61ae6/deploy-vm-6460677a198b-20261007T104230Z.json`。本轮未提交、未合并主线，独立下载包不包含其他两个任务新增界面。

当前VM已恢复原始“跟随”主题，布局树确认选中true；停留在存储管理弹窗。实际1280×2832px /3.5日夜与关闭重开均测得unknown summary35.14vp/标签top14vp，Select88×31vp、设置行50vp、footer44vp及安全区底28vp。真实Button disabled；视觉按完整CSS级联0.5整组混合，日间背景247/244/238与字形186/182/177，夜间背景44/48/41与字形106/107/98，和Chromium Canvas参照相符（允许单通道1级平台量化，非任意容差）。批准HTML/SHA未改。三项差异已闭环。

最终包原生已验证上限菜单四项、1GB选择关闭重开回显、禁用清理点击不出现确认，系统返回恢复下载列表；未执行删除。书架继续阅读仍06·5页/24页，与安装前一致。第一张标记day的最终包截图实际处于night，因此场景前提失败保留，后来明确读取主题选中状态再逐页核验日夜，未将文件名当主题证据；中间Fc包一次连发坐标导航误入阅读页，旧“theme-restored”文件没有跟随选中证据，恢复声明由本最终包实际selected=true截图取代，不归因VM故障。

范围仅默认字体/当前VM窗口/unknown容量的样式与现有UI行为。容量统计、设置持久化和清理操作仍待接线；已知容量数字及可清理确认仅代码/SDK通过，VM保持OPEN；其它窗口/字号和触摸浏览器变体不以本次当前VM截图替代。用户验收OPEN。所有原始失败、取消批次及中间包证据保留，私有汇总 `storage-management-v2-vm-result.json`。

最终截图：`.reader-local/shared-download-native/storage-v2-approved-final.png`（恢复跟随后的当前浅色）；深色：`storage-v2-approved-night.png`。
