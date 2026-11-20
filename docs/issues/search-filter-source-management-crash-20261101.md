# 搜索筛选前往书源管理闪退（2026-11-01）

## 用户报告与输入

- 用户反馈：“书源管理的界限错误，从搜索结果筛选点进去直接闪退”。明确故障为搜索结果筛选/书源分组的“前往书源管理”跳转闪退；“界限错误”的具体画面含义待证，不能擅自改为已定位的布局问题。
- 上次实际安装候选：`20261101T040934Z-fce869a1-d0275a47`，signed HAP SHA-256 `0104069c127afed364faeff3612b94745e52fa88b17f941e10fac98a753ea2a4`，Harmony `fce869a1` / Core `80d614e9` 均含 dirty 输入；精确快照与部署回执由该 immutable run 绑定。
- 上轮仅安装/启动与一张书架实屏通过；没有执行此跳转或书源管理原生验收。独立合同/SDK 探针和 demo 的 PASS 不证明此路径已运行。

## 初始代码审计与待答问题

- 审计搜索面板 `manageSources`、SearchPage 的原子关闭/导航、Index 的实际 source-management 挂载与卸载，以及 SourceManagementPage 及共享筛选组件的真实 DTO、Props、Builder、生命周期。
- 当前未取得本次崩溃栈，尚未定位原因；不得把签名/安装成功当作闪退已修，亦不据症状猜测用户数据损坏。
- 先使用已有源码、日志与准确本地方法/SDK 探针定位。若代码侧仍不能确定异常点，另记已审范围、排除项和最小日志取证问题，才对准确真机采一次已有故障日志；不先反复点击复现、不清数据。

## 当前结果

- 状态：原搜索筛选链已由用户确认“都正常了”（排版/关闭/跳转与返回）；最新反馈为书源管理页大量尺寸问题，作为相邻页面的新布局问题继续处理。不得把该路径通过扩为书源管理整页视觉验收。
- 上轮 native sheet 退出边界修复及其7个用例/构建/安装证据保留，但没有解决本次实际退出点。新修复尚未完成设备交互验证。

## 代码侧第一轮定位与最小日志取证依据

- 当前 `ReaderSearchFilterPanel`、`SearchPage`、`Index`、`SourceManagementPage`、`ReaderFilterControls` 五个实际输入 SHA 与已安装候选 `source-snapshot.json` 一致，排除用别的源码版本解释该候选。
- 已审 Index 的搜索导航、source workflow 的实际 DTO 传参及 SourceManagementPage onAppear/Builder。sources/catalog/view 均有实际默认与传参，未发现可直接证明的 undefined 输入路径。安装 SDK runtime 明确允许可选 Prop 的 undefined，不能据它猜测崩溃原因。
- 发现时序风险：SearchPage 请求关闭后同栈立即导航，未等待 native sheet onDisappear；expanded=false 会让 header/body/actions slot 先变空。此链部分已在改造前存在，尚不能据此断言本次闪退根因。普通延迟焦点/草稿初始化先校验 mounted，可排除无守卫直接进入这些回调的简单猜测。
- 剩余唯一待答问题：本次已发生闪退的异常类型、真实栈顶与组件/调用链，区分 native sheet 退役问题和 SourceManagementPage 首次构建/DTO问题。现有本地探针的消息/UI边界端口不能证明 native 注销对象安全，也不能提供该设备的实际异常栈。
- 最小真机取证：只在准确 Connected 目标上读取已有 Reader crash/faultlogger/hilog 记录一次，绑定当前 installed candidate；不启动或操作 App、不重复触发、不截图/录屏/AX采集、不安装/清数据。先取最新关联记录，拿到本次异常后停止无关采样；若无记录则保留缺口再决定下一步，不能循环触发。

首轮日志结果：全局 `/data/log/faultlog/faultlogger` 返回 Permission denied（HDC exit0不等于目录可读）；一次非阻塞过滤 hilog 仅含系统推荐中的bundle文字，未含Reader异常栈。原结果保留于本聊天私有 `source-management-crash-20261101/`。下一步只检查官方 `shell -b io.reader.minliny` 的应用自身日志目录可读性，且只读 hilog help 确认持久日志查询能力，不重采同一缓冲、不启动App。

新增最小代码探针：仅检查/执行真实SDK生成的 SourceManagementPage.backBar→PageBackBar trailing slot→SourceManagementMoreMenu 实例化链。项目历史已存在内联Builder slot把组件类当普通函数调用的确定反例；该探针用于排除同类入口异常，不扩大为整页/全量测试，不得用Port替代待证的MoreMenu组件。

## 后续定位与本轮授权

- 用户澄清“主要指点击后闪退”，本轮不扩展为书源管理页面重设计。
- 实际SDK输出对 backBar trailing 明确使用 `new SourceManagementMoreMenu` / `ViewPU.create`，执行真实PageBackBar slot能构造真实Menu，无异常；排除历史组件类普通调用假设。初次探针的无关Icon fixture初始化失败保留，不能算生产异常。
- 官方应用日志目录也返回 Permission denied；不更改权限、不安装侦测App、不中止/重启设备或服务来绕过访问限制。
- 用户对一次90秒不截图复现选择“先只修代码并交付”。因此不执行触控复现、截图、录屏或AX布局采集；原有构建与保数据安装授权继续用于修正版交付，不误解为取消交付。
- 修复限定为已确认的native sheet退出边界：搜索来源管理意图等待真实onDisappear回执再导航；关闭动画保留同opening内容；已卸载/旧opening/重复回执不得访问注销Prop或触发导航。不用定时器猜测退场结束。
- 增加native关闭事实回调是本次闪退修复所需的最小接口扩展；不改变草稿/应用规则、业务source/catalog数据、Core、schema、版本或签名身份。尚无实际异常栈对照，不能将这两处代码缺陷直接写成已证设备崩溃根因。

## 修复与最小验证结果

- SearchPage 的来源管理意图仅关闭面板，在真实 onDisappear 回执且原页面/展示身份仍有效时一次性导航；取消、新查询、重新打开、卸载清理 pending 意图。
- ReaderSearchFilterPanel 保持退场中的 header/body/actions 子树，旧/重复/卸载回调直接终止；外部 onDismiss/onClosed 前缓存 Props，避免外部同步卸载后读取注销 Prop。
- 本次所选入口及理由：`test-search-results-static.mjs --case filter-management-exit,query-actions,filter-popup,filter-sheet-opening` 只执行 4 个指定方法/SDK 场景，保护等待关闭再导航以及既有查询/打开行为；`test-reader-filter-controls.mjs --case filter-sheet-exit,search-draft` 只执行 2 个指定场景，保护真实 SDK 下关闭生命周期与草稿；`test-search-static-implementation.mjs --case compact-sheet` 只执行紧凑原生 sheet lowering 场景，保护新增回调接线。三入口均不附带构建、HDC 或全量套件。
- 初次结果汇总脚本变量错误，无法保留退出回执，记 UNCONFIRMED；确认旧 node 进程均已结束后，同范围改用文件回执执行。第二次三个入口均 exit0，7 个 case 明确 PASS，约 1.5 秒/入口；不把汇总错误记为生产故障或改写原次结果。私有日志及回执位于本聊天 `source-management-crash-20261101/`。
- 下一动作仅是交付刚需：使用已验证的实际 Native producer 缓存，规范 iteration/local signed 构建，contracts-scope none；隔离输入/工具链、包/Native/Profile/指定签名身份校验由 pipeline 执行。部署时另核准确物理目标与保数据准入。无产品版本、包名、Core/schema 或签名体系变更，不补业务全量。

## 构建与部署预检

- 签名构建 PASS：`20261101T045025Z-fce869a1-1f1da8dd`，signed SHA-256 `794cb067d0f43c4610ec4f330a2988b2c3e7e7dcb6eed398764f67708da4ede2`，214762327 bytes，耗时 52.162 秒。指定证书身份验签通过；合同 scope none 为 NOT_RUN，独立 7 个用例的 PASS 不冒写为 manifest gate。
- 精确物理目标脱敏引用 `929ff1c0644b`，本机 server `127.0.0.1:8710`；租约 discovery 明确 Connected，已有 hdc PID 40881 复用无重启。实际设备 TCP ESTABLISHED，LAN route 经 en0，调用链清除大小写代理变量且 NO_PROXY/no_proxy=*。
- 首次只读 inspect exit3/STOP：签名允许 matching-identity-signed-update-candidate，系统 boot completed/SceneBoard stable；存储拒绝原因为 `application UID still has a writer process; no storage admission`。没有复制数据库或安装，不把 STOP 写成通过。
- 源码核对 `storage-device-evidence.mjs`：inspect 要求现成停止态而不会主动停止；规范 install 在验过候选 inspector 后执行 force-stop，再建立同一 UID 写屏障、唯一备份和安装紧前复核。因此不重试 inspect，下一次仅执行已授权的保数据 install，显式 --no-launch，不触控复现/截图/布局采集。

## 修正版交付结果

- 规范 install PASS，耗时 46.884 秒，完成于 2026-11-01 12:52:33（上海）；同一 run `20261101T045025Z-fce869a1-1f1da8dd`、同一 signed HAP SHA、同一精确物理目标。部署回执 `.reader-artifacts/hap/20261101T045025Z-fce869a1-1f1da8dd/deploy-physical-929ff1c0644b-20261101T045233Z.json`。
- dataPolicy=preserve，storageAdmission=READY，dataRecheck=PASS，freshStorage=false；现有布局 schema44/数据格式代际1，migration=null。完成停止态一致备份和安装紧前复核，无卸载/清数据。备份位置见私有部署回执的 recovery。
- postInstall 核对 bundle `io.reader.minliny`、versionName `0.2.0`、versionCode `1000000` 及指定证书身份匹配。安装只消费本次 immutable manifest 的已验签字节，未使用共享 build 输出。
- launch=NOT_RUN（--no-launch）；未启动/触控复现、截图、录屏或 AX 布局采集。闪退实际消失、native onDisappear 的设备送达与用户验收仍 OPEN，不能由代码/SDK/构建/安装 PASS 外推。
- 本轮业务全量 NOT_RUN，未改产品版本、包名、Core/schema、签名身份或并行 dirty WIP。账户 remaining 约25%，未触发用户要求的低于1%停止条件。

## 修正版仍闪退：重新取日志

- 用户确认修正版仍闪退，并明确要求重新抓取日志。上次 native sheet 退出边界修复未解决实际故障，不再把它当作已证根因。
- 现有源码审计与 SDK 探针已排除部分 DTO 缺省和组件类普通调用假设，但无法提供设备异常栈；旧日志无 Reader 栈，且发生在此次修正版用户点击之前，不覆盖新事件。
- 本次唯一待答问题：最新 Reader 闪退的异常名、堆栈及发生时间，是否能绑定当前修正版调用链。最小入口：准确本机 Connected 物理目标上的一次已有 hilog 错误/崩溃记录；按日志命中结果再收窄 PID/标签必要上下文。只读，不启动/触控/截图、不更改日志配置、不清缓冲、不安装或清应用数据；取得异常栈即停止无关采样。每条命令最多30秒，无循环重试。
- 首次命令错误组合 -x/-z，设备明确拒绝，未读到日志，保留为采集错误；依据已读 help 去掉互斥 -z 后，一次非阻塞 E/F 错误快照取得完整 Reader 栈。没有清缓冲、增大日志或更改持久配置。
- 2026-11-01 13:10:54.719（设备本地时间），PID 3884 的 AppKit 明确记录 `io.reader.minliny is about to exit due to RuntimeError`、Error code `150003`、`The component doesn't exist, is currently invisible, or has been disabled.`。栈为 ArkUI FocusController.requestFocus → `ReaderSearchFilterPanel.ets:197:48` → `SearchFilterFocusFrame.onFrame:24:39`。已取得应用退出与异常调用链，停止无关设备采样，不再读取受限 faultlogger 或重复触发。
- 当前 bm 元数据 updateTime 为 2026-11-01T04:52:33.024Z，与上轮安装完成 04:52:33.816Z 一致；bundle/version 为 io.reader.minliny / 0.2.0 / 1000000，栈行与本轮修改前生产源码一致。BM 不提供已安装 HAP 原字节，本结论不宣称重新读出了 Native/HAP。
- 确认直接根因：逻辑 opening/action 守卫通过后，延迟焦点恢复仍可能命中尚未出现/已经不可见的 native 节点，requestFocus 的平台异常未捕获并从 FrameCallback 冒泡退出应用。具体节点失效的时序尚未单独观察；无需用猜测的 SourceManagementPage 数据错误替代明确堆栈。
- 本地 SDK `@ohos.arkui.UIContext.d.ts` 明确 requestFocus 立即生效，声明 150001/150002/150003 三类焦点不可用错误。修复限定该可选焦点边界：未挂载/关闭不排队，帧内核对 opening/action/step/native appeared，跳过本地模式禁用目标；原生 onAppear 后补排当前焦点，三种声明错误只放弃本次恢复，未知异常继续抛出。业务草稿与导航不借此重试或变更。
- 最小回归入口：`node tools/test-reader-filter-controls.mjs --case filter-focus-lifetime,search-draft,filter-sheet-exit`，只运行新增实际生产帧/FocusController异常码用例，以及受 onAppear 补排影响的草稿与真实SDK退场场景；无嵌套HDC/构建/整组。旧 Page 的4个查询/导航场景及compact-sheet在代码对应行为未变时 REUSED，不重复运行。随后构建只为交付本次焦点修复，iteration/local signed/contracts-scope none，不隐式增跑门禁。
- 上述3项均 PASS/exit0，1.773秒：生产 FrameCallback 实际进入可抛150001/2/3的native边界，三种声明错误均不逃逸且不应用/关闭/导航；未知错误原样抛；native onAppear 后焦点可达，早帧/旧opening/action/step/关闭/卸载/本地禁用均不发请求。测试边界为方法/SDK，不是设备原生效果。
- 取证私有目录 `source-management-crash-recapture-20261101/` 保留 raw快照、互斥参数失败、bm元数据及回执；`reader-crash-stack.txt` 只提取 Reader ArkCompiler/AppKit 的53行异常栈，排除其他应用和无关资产日志。
- 首次焦点修复签名构建 FAIL，40.960秒：真实 CompileArkTS 拒绝 `throw error` 的隐式任意类型（arkts-limited-throw），点位为未知错误再抛分支。改为 Error 类型断言后原对象再抛，不改变异常身份或吞错误范围；原失败回执/日志保留。该类型约束不由转译/方法探针证明，未将本地3项PASS当作全App编译PASS。只补受改throw分支的 filter-focus-lifetime 与交付构建，不机械重复未受影响场景。
- 补跑 filter-focus-lifetime PASS/exit0（0.620秒）；第二次真实隔离签名构建 PASS（68.744秒），run `20261101T051811Z-fce869a1-6a82797e`，signed SHA-256 `93076885051f1e9240e3c0e1fde50d60982b8cf3300f004bb7fdac6f4dc08cef`，指定证书身份验签通过。scope none 保持 NOT_RUN。
- 本次已在取证阶段读取当前安装元数据和准确连接，签名/Native/存储合同未变；不另跑只读存储 collector 复制同一数据两遍。独立 inspect 为 NOT_RUN；规范 install 自身仍重新核 candidate manifest/目标/签名并建立新的受控停止态、一致备份和安装紧前复核，旧回执不作为 live permit。显式 --no-launch，无触控/截图/重现；部署 inspector 继续显式复用原实际 CARGO_TARGET_DIR。
- 焦点修正版保数据 install PASS，57.019秒，完成于2026-11-01 13:20:05（上海）。部署回执 `.reader-artifacts/hap/20261101T051811Z-fce869a1-6a82797e/deploy-physical-929ff1c0644b-20261101T052005Z.json` 绑定同一 signed SHA及精确物理目标。
- storageAdmission READY、dataRecheck PASS、dataPolicy preserve，schema44/代际1、migration null；新一致备份见回执 recovery。postInstall包名/版本/计数器与指定签名身份匹配；launch NOT_RUN。无卸载/清数据、无变更签名/版本/Core/schema，无新的触控/截图/布局采集。
- 已证明实际异常出口、代码修复及定向异常注入行为；这次新包的设备点击路径没有运行，仍不把安装成功写成闪退消失。当前remaining约25%，未触发低于1%停止条件。

## 焦点修正版用户再次报告闪退

- 用户再次反馈“还是闪退”。最近安装候选为 `20261101T051811Z-fce869a1-6a82797e`，signed SHA `93076885051f1e9240e3c0e1fde50d60982b8cf3300f004bb7fdac6f4dc08cef`。不能把前一条150003堆栈直接当作这次新事件的原因，也不能把旧3项定向PASS等同整条设备路径完成。
- 既有代码审计已定位并处理前一事件的焦点异常出口，但新事件仍缺异常栈，代码侧无法确认同因/另一出口。本次最小取证问题：读取用户刚发生的Reader退出栈，核其时刻、异常及当前安装更新时间；准确租约目标、一次现成非阻塞错误快照，命中即停止，不启动/触控/截图/布局采集、不清日志或App数据、不改日志配置。普通命令每条最多30秒，无循环重试。
- 当前错误快照7行，没有Reader AppKit/ArkCompiler退出栈；Reader初始化记录13:26:24.682、PID17995。bm updateTime=2026-11-01T05:20:04.488Z，匹配焦点包的13:20安装时间，排除直接拿13:10旧栈解释当前事件。当前日志不足以区分进程异常/系统终止/页面退回。
- 新的最小未决问题转为该PID退出方式；仅收窄读取PID17995的各等级历史日志，必要时才查询该PID/包名的系统退出上下文。此前E/F筛选不能覆盖INFO/WARN或native退出原因，不对同一E/F缓冲盲目重采，不启动/触控。
- PID全等级与精确包名/PID系统上下文均返回空，保留各次回执，不把无栈当作无崩溃。现成缓冲已无法回答当前退出方式，停止继续采空。代码侧复核当前 SourceManagement 首次 ReaderSearchField 不会走自动聚焦；Index初始Props完整，尚无能独立证明的新异常。
- 已请求用户准备好后，手动复现一次并同步30秒实时日志。此为取得缺失堆栈所需的最小新输入；不由agent触控，不截图/布局采集，不清缓冲/改日志配置。用户准备信号未到前不启动倒计时、不开循环采集。本地并行只运行真实 SourceManagement.searchField→SourceFilterPanel→FilterTrigger SDK组合探针，明确不是完整原生页面验收，待证目标不用Port。
- 用户准备就绪后实际开启一次30秒live窗口，由用户自行点击，无agent UI操作。首次过长regex被设备拒绝，缩为127字符内后才提示开始；拒绝与有效窗口回执分别保留。有效窗口以客户端预算到期124结束（30.261秒），共享HDC服务未停。
- 13:32:23.200，最新包进程PID26889仍出现AppKit RuntimeError150003；堆栈更新为Panel:201:50/Frame:25:39，随后明确 `PROCESS_KILL,JS_ERROR`、`isUncatchable=0`。确认新保护分支未拦下同一类错误，不是无栈推测；拿到栈后无后续设备采样。
- 并行真实SDK组合探针仅运行一次（约1秒）：真实Page.searchField→真实SourceFilterPanel→真实FilterTrigger首次挂载及sources/view/count更新可达。最后badge文本断言因probe默认不展开已空分支而失败，原exit1/fixture限制保留，不报整项PASS，也未再改fixture/重跑；未复现当前生产退出点。
- 漏洞在错误码边界：前轮只注入SDK声明的numeric三码；官方OpenHarmony `js_focus_controller.cpp` 的NON_EXIST走 `NapiThrow`，`napi_utils.cpp` 将errCode转std::string并调用napi_create_string_utf8后传给napi_create_error，Error.code因而可为string。严格numeric比较会重新抛出字符串150003。官方上游构造链已核，尚未直接读取手机异常对象的typeof；本次同时兼容number/string，以真实旧方法负控和新增用例验证，不能把numeric stub等同native错误对象。
- 官方来源：[FocusController原生调用](https://github.com/openharmony/arkui_ace_engine/blob/master/interfaces/napi/kits/focus_controller/js_focus_controller.cpp)、[NapiThrow错误构造](https://github.com/openharmony/arkui_ace_engine/blob/master/interfaces/napi/kits/utils/napi_utils.cpp)。本地d.ts和上游runtime形态不一致，前轮未核此边界导致测试漏检，失败结论保留。
- 新增字符串三码及未知字符串码后，旧numeric-only生产帧单case明确 FAIL/exit1（1.958秒，首个字符串150001异常逃逸）；不是把旧PASS追溯改写。随后仅将该边界用String规范化后比较三个已知码，保留数字码、未知码仍原对象抛出。只重跑这个实际受改的filter-focus-lifetime，草稿/关闭/导航语义未变的前证 REUSED；交付构建仍 iteration/local signed/contracts-scope none，未补整组门禁。
- 规范化后单case PASS/exit0（1.787秒），覆盖number/string已知三码及未知码重抛；真实隔离签名构建PASS（184.045秒），run `20261101T053706Z-fce869a1-31dd140e`，signed SHA `1ca2f09864d7883db4eb261c33ddd27eb77f69aed2b3042bd6ff65b54164c2c4`，指定证书身份通过。期间未因耗时重复本地/远端构建，未重编Native。
- 交付动作仍使用实际inspector缓存和规范install自身fresh目标/签名/存储准入与唯一一致备份，--no-launch；独立inspect不复制同一容器。安装后唯一未决问题是用户原点击路径是否仍触发退出，拟同步一次30秒只读live窗口由用户手动点击；不由agent操作UI，不截图，不扩大回归。
- 兼容number/string修正版install PASS（49.399秒），2026-11-01 13:39:16（上海）完成。回执 `.reader-artifacts/hap/20261101T053706Z-fce869a1-31dd140e/deploy-physical-929ff1c0644b-20261101T053916Z.json`，storageAdmission READY、dataRecheck PASS、dataPolicy preserve，launch NOT_RUN，无卸载/清数据。
- 安装后提示用户手动打开并点击原入口，同步一次30秒验证日志（13:39:50.522–13:40:21.747，客户端124有界结束，未停服务）。该快照没有新的Reader RuntimeError/PROCESS_KILL记录，但最后Reader日志为13:39:25，不能仅据无栈宣布用户动作已执行或路径通过；点击结果问题保持等待用户答复。若需补后态，仅一次准确包名pidof确认是否存活，不采UI或重复业务。
- 13:41:21一次pidof结果为空，无法单独区分未打开、已关闭、进程名匹配问题或再次退出，不据此写成PASS/确定新故障原因。已停止设备操作并释放租约，等待用户点击结果；没有用无结果的重复采集替代输入。

## 用户反馈：错误分组画面与无法退出

- 用户反馈最新包“进入了错误的书院分组页面，显示异常且无法退出”。先按原话记录，不能擅自认定已进SourceGroupManagementPage或宣称闪退完全解决；正在以控件文字区分仍可见的搜索groups sheet和真正分组管理路由。
- 已审实际路由：SearchPage只在native onClosed后调用Index.manageSourcesFromSearch；Index.openSourceManagement明确selectSourceWorkflow('list')、route='source'，没有从此入口主动选groups。selectSourceWorkflow每次递增revision，尚未发现可直接证明的“主动跳分组页”参数错误。
- 已发现关闭状态缺口：父expanded=false后保留groups子树等native退场，但onWillDismiss和header关闭/返回业务动作均要求expanded=true；若native尚未完成退场，则可见内容的退出回调均no-op，pending又只等onDisappear才导航。该缺口能由方法场景证明，但程控false未退场的原生原因与用户实际画面仍未证；先审SDK/原生dismiss机制，不用延时强制导航猜测修复。
- 用户澄清“是排版问题”，撤回未证的错误路由解读；不能以源码中固定list入口就认定画面正确。已审Source/SourceGroup布局、PageScaffold与Header/叠层以及search sheet单实例/State→Prop链，代码不能还原当前具体裁切/遮挡，尚无已证布局根因。
- 官方native审查表明bindSheet(false)直接CloseSheet，不经过onWillDismiss；交互Back/滑动才由onWillDismiss裁决。因而关闭守卫缺口只是恢复路径不足，不能说它直接拦截程控false；该假设保持未证，不据此先发修正版。
- 用户已明确允许“仅读取当前画面一张”。取证只回答异常画面实际类型、标题/列表/返回控件的尺寸遮挡与位置；准确现场目标，单次当前screen capture并取回，无启动/点击/录屏/AX树，不重复截图。取得后回到代码修复；不扩大为agent触控复现。
- 唯一实屏已取得（1280×2832，SHA `5dd7f25cc8e6d211ca45d14f6255720308220aec164de047d7d655fb268642ab`，私有 `source-layout-20261101/current-screen.png`）。准确目标readiness PASS，HDC租约/local server/实际LAN route en0核对；未触控/启动/录屏/AX。首次编排误按success关键字判断有效 `ScreenCap saved to ...` 回执而中止取回，随后只recv该已存在文件，没有第二次截图；保留该编排失败。
- 实屏确认是搜索结果上方的“书源分组”原生sheet，不是真正SourceGroupManagementPage。“全部分组”选中行占据列表大部、竖条同样异常拉长，下一行被挤到下沿；来源管理按钮仍在sheet底部。撤回“主动进入错误分组路由”解读。
- 布局缺陷：公共ReaderFilterGroupRow在仅有minHeight的auto Stack内放入calc(100%-28vp)高的普通child，该percent子项参与测量并把行高撑到可用viewport；opacity=0的未选标记也不退出测量。修复将标记移出布局树，保留3vp宽/上下14vp视觉与非命中，不用固定文字行高截断长组名；最终采用下述原生DrawModifier。
- 同时确认header frame测量不含外margin titleBottom12，而Panel收到frame后直接作为完整header预算扣除；已补measured/fallback均+titleBottom。只改对应sheet预算，不全局改Header测量合同。
- 可见退场阶段native交互dismiss要求expanded=true会让Back兜底失效；补同opening retains身份且expanded=false时完成native dismissal，业务动作仍拒绝、旧opening/卸载仍拒绝、导航继续等真实onDisappear。它不是程控false未关闭的已证原因，只是用户“无法退出”对应的独立恢复缺口。
- 公共行修复改用平台DrawModifier在绘制阶段按实际bounds画3vp/上下14vp装饰，不再创建任何百分比布局子项；避免auto行高下overlay百分比参考仍不确定。只作平台薄适配，不新增自研颜色/文本测量算法，不以额外State回传行高。
- 当前最小入口：`test-search-results-static.mjs --case filter-group-layout-budget,filter-native-closing`只执行真实高度方法/原生dismiss回调场景，保护字体1/1.6下总高守恒、测量不累加和同opening关闭Back/拒旧/卸载，不附HDC/构建。共享row精确case与受提取依赖影响的search-draft待公共绘制适配冻结后另列；不跑其它业务套件。
- 上述两个sheet case PASS/exit0（0.829秒）。公共row代码已冻结，新增精确 `test-reader-filter-controls.mjs --case group-row-layout,search-draft`：前者执行真实SDK行树及实际绘制类，在Day/Night、密度1/2/3与短/长bounds验证仅文字参与测量、marker实际坐标受bounds限制、未选不画及disabled/卸载回调；后者仅补sheetOptions新增真实方法依赖并保护原草稿/关闭行为。平台Canvas端口不能替代native像素，未扩大trigger/footer/其它宿主套件。
- 公共row与search-draft两项PASS/exit0（1.361秒），合计本轮4个准确case通过。后续仅作交付必需的真实CompileArkTS/包/Native/指定签名校验，iteration/local signed/contracts-scope none。新原生绘制API的完整类型校验仍以实际构建为准，SDK探针不冒充完整编译；不重跑未变业务或用户已退出的历史套件。
- 排版修正版真实隔离签名构建PASS（49.966秒），run `20261101T061849Z-fce869a1-1d53af78`，signed SHA `5d406163a0e1ea9500f563a6dfc067e291906b9af816c52871da9c176fc29fa7`，指定证书身份通过，scope none仍NOT_RUN。独立API复核确认DrawContext.sizeInPixel为px，vp2px转换匹配；ColorMetrics getter/drawing.Color通道均0–255，不混工厂rgba的0–1 alpha。
- 接下来仅按规范install建立fresh目标/签名/存储准入与唯一一致备份、--no-launch，缓存路径保持原实际producer/inspector。用户只允许当前一张实屏，不自动增加安装后图或UI操作；原点击路径的排版与关闭结果由用户反馈确认。
- 排版修正版install PASS（35.861秒），2026-11-01 14:20:28（上海）完成。回执 `.reader-artifacts/hap/20261101T061849Z-fce869a1-1d53af78/deploy-physical-929ff1c0644b-20261101T062028Z.json` 绑定signed SHA与精确物理目标；dataPolicy preserve、storageAdmission READY、dataRecheck PASS、migration null。postInstall io.reader.minliny /0.2.0/1000000及签名身份匹配，launch NOT_RUN。
- 已提示用户手动验证行高、返回/关闭与“前往书源管理”，问题等待反馈。没有新的截图/触控/AX或自动启动，不把构建、安装和绘制端口PASS当作新原生像素/操作通过。当前remaining约24%，未触发低于1%停止条件。

## 用户确认排版/关闭正常，来源管理仍未跳转

- 用户确认最新排版包“排版和关闭正常，但是无法跳转书源管理页”。仅将排版和关闭记为用户报告通过；管理跳转仍OPEN，不用前两项覆盖整条路径。
- 先审代码：Index管理回调guard不依赖SearchHost当前presentation，sheet关闭/foreground Watch不推进navigationGeneration；一旦进入openSourceManagement先设置route='source'才bind/open，所以不能笼统归因SourceHost绑定。SearchViewState.prepareReturn仅写返回step，不改变page/query revision；普通pending→closed方法链没有必然的拒绝点。
- 新待证候选：ArkUI @Builder非跟踪action值参数经sheetBody(action)→groupsContent(action)在step内部If更新时可能保留原filter action，管理按钮回调继而被当前action守卫拒绝。既有普通方法检查直接传正确action，未覆盖真实retained slot的step更新。已请求用户区分“关层不跳”与“连弹层也不关”，没有安排新截图或触控。
- 最小本地验证：真实V1 Panel+BoundedSurface/Header，首次仅初始化一次filter slot，之后仅完整Prop更新/flush到groups，不手动重建slot，点击实际生成的管理按钮并观察action/pending/closed链；native按钮只作事件记录边界，不Port替代待证目标。最多120秒，fixture失败原样保留并停止，不补全量/不HDC/不构建。新证据决定修复，不先再发猜测包。
- 私有probe首轮因Header词法owner定位错误FAIL；核对归属后第二轮只修fixture定位，初始真实Panel/Surface/Header和完整Prop update可达，但既有renderer不替换nonempty If分支，尚未生成管理按钮而FAIL并停止。未改renderer或手动重调slot制造通过；两次边界均保留，不将其写成生产异常或行为复现PASS。
- 用户补充“按钮没反应，弹层也没关闭”，与点击先被action guard拒绝吻合。真实SDK输出提供确定代码事实：sheetBody(action)的观察闭包读取动态step却捕获首次action；BoundedSurface组件更新只传specId，不重绑Builder回调，外slot里的actionIdentity不是在自身ForEach观察块消费，不能保证新的步骤action传到叶按钮。普通方法手动传正确action的旧case没有覆盖此边界。
- 修复限定内容身份：保留原native opening ForEach/bindSheet，再在其内部以actionIdentity为key重建普通BoundedSurface内容，header/body/actions共享同一个不可变步骤action。action变化由真实ForEach观察，草稿留在Panel不重置，native sheet不重开；旧步骤事件继续拒绝。计划用真实SDK完整Prop更新检验新key可创建当前管理按钮，而不是改守卫接受旧action或在click时盲读新身份。
- 修正版私有probe最初仍报“无按钮”，已保留FAIL；根增加只读依赖/节点诊断后确认actionIdentity依赖登记到实际ForEach observer，flush后action keys与新真实Surface/Header均已创建，Panel.children中也存在当前管理按钮Port。原walk函数只递归有children的对象而漏掉所有Port叶子，是fixture定位错误，不能误报native分支失败。仅校正叶子遍历再做同scope验证，不改renderer/不手动重调slots，先前失败不改写。
- 叶子定位修正后的修正版私有probe PASS：真实步骤Prop update/flush生成当前groups按钮，actual manageSources接收当前action并派父意图。已迁移为精准 `test-search-results-static.mjs --case filter-action-slot-current`，真实Panel/Surface/Header通过实际按钮/行事件驱动真实Page.step方法往返，完整Props/flush、首次之外不手动重建slot；保护旧callback退役、draft保留、同nativehost、pending与nativeclosed后Parent.navonce，native按钮仅为事件记录端口。未直接量到手机partial-update，不冒充设备结果。
- 最小本轮检查选择：上项新case以及 `test-reader-filter-controls.mjs --case filter-sheet-exit`（key变化需复核原生退场内容保留/关闭事实/销毁Prop安全）；均无嵌套HDC/构建/全量。上轮行绘制/高度预算/普通草稿及焦点码未变，准确前证REUSED，不机械重复。独立review确认ForEach无新布局实体，native host唯一且draft字段仍属Panel。
- 两项精确入口均PASS/exit0，分别0.952/0.969秒。源码修复仅Panel内容步骤key与新回归，先前用户确认的排版公共行未改。后续仅交付刚需iteration/local signed/contracts-scope none，实际CompileArkTS/Native/指定签名身份由pipeline核验，不因此补业务全量。
- 导航修正版真实隔离签名构建PASS（45.573秒），run `20261101T065149Z-fce869a1-ae255483`，signed SHA `67affab6191566584e784062302b7e4ca2b6385007d9ae0850135b0867826a06`，指定证书身份通过、scope none保持NOT_RUN。接下来仍由规范install fresh核准确目标/签名/一致备份与安装紧前数据，--no-launch，不增加截图/UI操作；Native/inspector复用原实际缓存。
- 安装前当前target为Offline、无设备ESTABLISHED socket，未直接安装。只做一次已知端口直连TCP检查56ms成功，保持原server租约做一次tconn，随后准确list明确Connected且实际hdc PID40881设备socket ESTABLISHED、route en0；没有因Offline推断授权问题、没有循环重连或重启共享server。连接恢复后才继续规范安装。
- 导航修正版install PASS（35.641秒），2026-11-01 14:54:02（上海）完成；回执 `.reader-artifacts/hap/20261101T065149Z-fce869a1-ae255483/deploy-physical-929ff1c0644b-20261101T065402Z.json` 绑定本次signed SHA和准确物理目标。dataPolicy preserve、storageAdmission READY、dataRecheck PASS、migration null，无卸载/清数据；launch NOT_RUN。
- 已提示用户手动打开并验证管理跳转/返回，尚未收到该新包结果。不再截图、不由agent触控或采UI；先前排版/关闭用户报告保留，不扩成全部业务验收。当前remaining约23%，未触发低于1%停止条件。
- 用户现已确认最新导航包“都正常了”，即本题原搜索分组排版/关闭/管理跳转与返回的用户报告PASS。另报书源管理页大量尺寸问题，转新问题记录继续，未运行其它页面业务或全量验收。
