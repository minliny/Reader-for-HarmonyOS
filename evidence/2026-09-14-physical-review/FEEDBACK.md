# 2026-09-14 真机人工审视反馈

## PH99：搜索结果封面偏小、行高不合适及封面下方留白（2026-09-15）

- 用户现象：搜索结果书籍封面大小以及每列/每行高度不合适，封面下方大量空白。
- 当前源码基线 Harmony `f716c6b5`。本次现场包未指定，上轮新产物仅构建未安装，不认定为现场包。
- 已开始审计 SearchResultCard、父 List/LazyForEach、缺封面及不同文案/标签长度；对照归档 Figma/Make 搜索 Version 5 与后续 PH63 标签调整要求。
- 代码初步定位：封面固定60×82（手机）/68×92（平板）；右侧简介及标签换行可继续增高，父行顶对齐且高度由文字决定。不是父列表显式固定行高。具体修复先对照既有设计，未改样式，未操作设备。
- 已完成 Make Version5 对照：原稿本身就是60×82，后续标签信息增加但封面/结构未同步调整。建议手机72×98、标签移全宽底部、字体不变、行高随内容；已给交互对照等待用户决断。详见[PH99审计](search-card-ph99/AUDIT.md)。

## PH98：个别主题下控制栏唤起时状态栏颜色错误（2026-09-15）

- 用户现象：仍有个别主题色下，控制栏对应的系统状态栏颜色错误；具体主题及背景/文字图标范围尚未提供，已询问，同时审计全部主题。
- 当前源码基线 Harmony `0905782c`；上轮新产物 `20260915T132601Z-1b2e6136-a0d4b317` 仅构建校验，未安装，不能把本次现象默认归到该包。实际现场包尚未核对。
- 审计范围：现有主题注册表→阅读外观→控制栏开合/主题切换→窗口颜色队列→状态栏背景实际绘制；核对八主题、应用日夜联动、隐藏/展示切换和异步写入。
- 既定边界：阅读页状态栏背景与文字图标取阅读主题；控制栏及普通应用页取应用主题。不更改主题原色或增加新的设计判断。
- 已复现并修复窗口旧颜色写入失败/旧窗口晚到回执吞掉最新主题请求，以及控制栏在可见策略不变时漏重试失败颜色的问题。新增真实 Coordinator 全8主题与受控失败/重建窗口回归通过，主题原色未改。具体反馈主题及手机偏色是否属于这些路径仍 OPEN，未操作设备；[报告及证据](theme-status-ph98/REPORT.md)。
- 最终新包 `20260915T134855Z-1def93b5-8ee07803` 已通过 274 组 Harmony、ArkTS、签名和独立 manifest 校验；包含上轮 PH94–97，尚未安装到设备。

## PH94–PH97：新包打开书籍、刷新与界面闪烁（2026-09-15）

用户人工反馈包为 `20260915T114122Z-13fa3794-46864a8d`（Harmony `13fa3794` / Core `2e5a3504d`，HAP SHA-256 `b67fff0a0247723bccf9d479cc39816cbb94b0bc5b34ceb6d040f3cfd5e6ec09`）。安装成功，自动启动因锁屏失败；用户后续人工使用产生本批反馈。安装证据见 [记录](search-flow-implementation/explicit-chapter-refresh/device-install/INSTALLATION.md)。

| ID | 用户现象与触发 | 当前调查范围与证据边界 |
|---|---|---|
| PH94 | 点击书架书籍卡住很久 | 先查缓存准入、正文验证、首屏测量、进度提交以及重复全量投影；具体阶段待生产方法探针定位。 |
| PH95 | 刷新本章始终报“跳转失败” | 查真实刷新→正文版本→metrics→测量→进度与失败恢复链，不能凭已有 URL 重定向缺口认定用户本次原因。 |
| PH96 | 阅读页返回详情，开始阅读及其他按钮闪烁数次 | 查返回路由、异步可读性投影与条件重挂载。 |
| PH97 | 书架列表/封面切换时右上图标消失后闪烁 | 查模式切换时工具栏的组件身份、资源与异步状态。 |

本批代码侧复现、修复及定向回归已完成，正在整合交付；本批不操作真机/VM。问题定义明确，无新增产品待决事项。后续修复、本地回归、产物、设备行为及用户验收分别补记。

代码侧复现与修复进展（同一批反馈，非新增需求）：

- **PH94**：带位置的缓存读重复捕获全书历史/标记、重复处理正文；Core 已改轻量校验并复用一次投影。合成大历史负载下 5 次读取由约 239ms 降到 17ms，只是本地探针，不是手机时延。Host 原先无位置验证一次正文，再因续读位置存在重读；现先读 Core 权威进度，带位置验证的交接仅在双版本及逐锚点完全一致时复用。真实 Index→LRE→网关回归确认相同续读 2 次权威进度/1 次正文，进度改变仍重新校验。目录下载状态/书签补充推迟到已提交首屏之后，期间新的书签修改保留。
- **PH95**：真实 Coordinator 复现了缓存刷新因自身递增版本而自取消；已修自己的修改与并发修改的区分、恢复提示 owner guard。刷新与进度落盘纳入同一串行队列，先等待既有提交、再捕获和发布正文，防旧提交破坏 CAS。另复现“Core 已更新正文但分页失败，重试仍带旧版本”的恢复缺陷；现按串行读取的当前版本/进度重新读取已提交正文，只自动恢复一次，持续故障保留明确提示，刷新错误不再误叫目录跳转。Core 新增与正文原子提交的逻辑章地址/实际响应地址证据，允许已证明同章的连续重定向；无历史证据且两侧地址均不匹配的旧缓存仍拒绝猜测覆盖。新老书签/划线及相对图片地址均按已验证绑定处理。
- **PH96**：详情按钮组件本身稳定；Core 已确认当前正文可读时，Index 仍因全局投影版本变化把 readable→verifying→readable，重复通知又启动竞争探针。修复将当前 Core 校验事实与旧正文引用分离，同目录与新目录均校验完整源/目录/上下文/版本及行身份，清旧引用但不无故改变按钮状态。过期目录自动沿原身份重新缓存优先准入，保留真实书架归属和返回搜索/书架路径，未引入确认弹窗。为防正文仍在加载就被重复过期通知打断，该次准入直到正文成功或失败才释放；延迟正文及重复通知已回归。
- **PH97**：书架模式动画把包含四个按钮的整行透明度降到 0（270–500ms），不是资源加载慢。已把这条透明度轨道仅绑定标题，四个按钮持续可见，原图案、尺寸和封面/列表动画保留；52 个日夜/双向采样与实际 SDK Builder 控件身份回归通过。

Core 生产提交 `5c79799d5`、补齐测试构造器及 Clippy 后最终 `c86b6aaec`；32 项位置/10 项存储定向与真实 HTTP 回归通过，全量脚本退出 0：3890/3890 断言、210/210 协议、fmt/clippy、strict drift、C/C++ ABI 通过，**保留 1 个既有同名 CLI host_replay LEAK 警告**，不称无异常。首轮测试构造器/Clippy 失败原日志保留。真实 Core HTTP→SQLite→位置→进度回执另经生产 Host 解码和带版本进度提交回归 4 分支通过。

证据汇总：[文件与校验索引](search-flow-implementation/explicit-chapter-refresh/regression-ph94-97/evidence-files.json)。本次手机原刷新弹窗的具体内部错误尚未取得，以上是当前代码确定缺陷，不把任一项冒称已唯一解释该次手机失败。全量 Harmony/HAP 及设备层结果另补；本批未操作设备。

首次 HAP 的本地回归阶段完成，ArkTS 编译在 `ReadingSessionFlowGateway.loadChapter` 异步闭包丢失 `ReadingSessionSource` 联合类型收窄处失败。已使用函数前段确认的远程 session 常量，保持相同实例和串行边界；真实协调回归再次通过，原编译失败日志归档。此轮未发布失败包。

**最终产物已完成**：run `20260915T132601Z-1b2e6136-a0d4b317`，Harmony `1b2e6136` / Core `c86b6aaec`，构建时两仓 clean；273 组 Harmony 检查、ArkTS、非增量构建、签名和独立 manifest 校验 PASS。签名 HAP SHA-256 `ef1d05a343bac16fcefc88ff39f5916f4331f238badd2d24c5a16ff5d07f4925`。本轮未安装/测试设备，交付级别 iteration。详见[修复交付记录](search-flow-implementation/explicit-chapter-refresh/regression-ph94-97/DELIVERY.md)。

## PH93：刷新本章仍显示旧正文（2026-09-15）

- 用户现象：点击顶部更多的“刷新本章”，正文不替换。对应已安装 run `20260915T081914Z-e5483b93-86eb9be1`，Harmony `e5483b93` / Core `cfb0208f4`，HAP SHA-256 `04ae9321ec60af7a970c6bfdf6177d77a23e4d9729769c88a0cd64ce1c239d35`；保数据安装回执 `deploy-physical-b1f20b88963d-20260915T102350Z.json`。
- 代码已定位：Host 跳过 chapterWindow，Core 跳过 chapter cache，HTTP `usingCache=false`。但 `remote_content_positions::publish` 要求本章进度、历史、书签、划线和临时锚点全部迁移；任一失败即成功返回旧正文 `via=cache / positionMigration.status=preserved`。已有真实 chapter.content→Host completion→SQLite 回归甚至断言收到 `NEW BODY` 后仍返回 `OLD BODY`。这是确定的实现缺陷，不需要再次真机抓取定位。
- 连带缺陷：页角书签及下拉删除仅按旧 offset 判断；当前章摘录补全丢 scope；目录快照忽略 scope/bookText 的变化。替换正文前必须一并防止错误标记、误删和伪造摘录。
- 修复边界：显式刷新取得有效新正文后更新本章；可可靠匹配的位置逐项迁移，不能恢复的阅读位置退章首，无法迁移的书签/划线原记录与旧版本证明保留且不套用到新正文。网络、解析、身份、并发和存储失败仍保留旧数据并明确报错。普通缓存读取不主动刷新、不删除本机数据。
- 已完成代码：Core `2e5a3504d`，Harmony `610ed24d`。显式刷新逐项迁移、有效 detached proof 的正文重建、原数据/版本保护已落盘；失配划线地址只使该旧划线保持未定位，不阻断新正文。成功/无变化/失败反馈、版本隔离的页角与下拉删除、原摘录保留、列表版本更新和卷标题准入、过期列表回调、冷开旧书签保护、正文版本参与错误恢复均已修复。
- 本地证据：[Core 全量](search-flow-implementation/explicit-chapter-refresh/reader-refresh-core-check.log)为 3,882/3,882、210 协议、fmt/clippy、drift、C/C++ ABI 全通过；最后划线 URL 单项保护补丁另由[最终位置组 26/26](search-flow-implementation/explicit-chapter-refresh/reader-explicit-refresh-highlight-url-final.log)、[真实 HTTP 刷新 1/1](search-flow-implementation/explicit-chapter-refresh/reader-explicit-refresh-highlight-url-http.log)及[Clippy](search-flow-implementation/explicit-chapter-refresh/reader-explicit-refresh-highlight-url-clippy.log)通过，未冒称在最终单项补丁后又跑一次全工作区。[Harmony 最终 268 组](search-flow-implementation/explicit-chapter-refresh/reader-refresh-harmony-final.log)通过，包含实际 LRE/Index 方法及目录/书签 Builder 的回归。失败前探针及证据校验见[文件索引](search-flow-implementation/explicit-chapter-refresh/evidence-files.json)。
- 明确保留的相邻缺口：书源最终重定向 URL 改变仍会被本章缓存 URL 身份校验拒绝；旧缓存未绑定原始逻辑章 URL/目录版本，不能凭当前 TOC 或删 query 猜身份后覆盖。已记根 DEVELOPMENT_BACKLOG PH93，现为真实错误和保留旧数据，不算已支持。
- 交付边界：本轮没有构建 Native/HAP、安装或操作设备；手机仍是上文 e5483b93 包。代码/本地回归完成，新包、设备行为和用户验收尚未完成。这里证明通用生产分支，不伪称已抓取用户当次真机刷新响应。
- 后续用户授权真机重装：Core `2e5a3504d` Native 已构建。首轮 HAP 在 ArkTS 编译阶段拒绝 LRE 两处对象展开（`arkts-no-spread`，原日志 `/private/tmp/reader-refresh-install-hap.log`）；Node 回归不覆盖这项平台语法规则。已改为显式复制全部书签字段并保留/撤销正确的 scope，重新构建后才可安装，失败包未发布、未操作手机应用。

## PH92：代理与搜索继续实施（2026-09-15）

当前实施、最终源码/产物和未验证层统一见[当前状态](search-flow-implementation/CURRENT_STATUS_20260915.md)。没有新增产品待决事项；已确定缺口继续实施，不能把旧分包快照当成当前未修改。

- 系统代理/PAC、当前网络合成DNS准入、HTTP取消锁、ArkWeb作业隔离、合法SDK错误wire、连续搜索与阅读worker隔离、正文失败候选回退、旧缓存保护均已实施。
- 6cf包的PH76 early/cancel两项真实原生样本均PASS；初始化blank误判已经修正，旧FAIL保留原包身份。[原生记录](search-flow-implementation/vm-6cf9705d/ONLINE_RUN.md)。
- c56实搜4.682秒采样已有正确作者，30.685秒处理66/109源；终态682组、16个源失败。详情自动选松鹤、首章可读，试读返回详情、换源复用现有候选、再返回原搜索已测通。[完整样本](search-flow-implementation/vm-c56ad545/ONLINE_RUN.md)。这不是精确首现时间或帧率测量。
- 实际编码`.length`异常已经修复并从c56日志消失；URL规范化/跨域Host另由6f486cfa补修。@规则作者重复、临时HTTP失败及旧失败记录降权的当前实施状态见统一页，不再称为用户未定事项。
- 最后已完成Core全量证据为c28的3860/3860、210协议及clippy/drift/ABI；后续Core/Native/HAP门禁在统一页按最终身份更新。所有旧门禁计数保留其时点，不拼成新包通过。
- 本轮未操作手机、未改系统代理/DNS、未清数据。原15项、全部实际来源、手机代理与用户验收仍按各自证据层记账。

## PH77–91 逐项复核（2026-09-15）

[15项最新状态表](PH77_91_RECHECK_20260915.md)：4、6、7、8、10、12、13、15的具体主问题已有修复与VM样本；5、11、14代码已改但关键验证未全；1–3及9仍只部分修复。既有通过的几何/入口不因额外动效未验而重新记成未实现；性能及真实原书正文也不因基本交互通过而关闭。该表来自修复前逐项复核；后续代理与搜索实施以本页顶部及专项报告为准，不把早期“未改生产”当作当前状态。

## 《鸣龙》全链路补充审计（2026-09-15）

[完整报告与13项分层结论](minglong-full-assessment/REPORT.md)已关联 PH71/PH76/PH77–79/PH85：实际生产方法复现了正文失败不续试同组、只试3个未知候选漏掉第4个可用源、错误API消息/解析日志/JSON包装被标可读、目录JS异常退化为空目录，以及换源8源批屏障与单条坏记录拒绝整批。13项是审计分解，不是13个新需求；合成回包不等于真机原响应，具体源失败比例仍未取得。最后真机有回执包1d1f47e5/Core61a2f86e尚未包含后续搜索渲染与共享队列修复，不能用当前VM状态代替手机状态。

PH76固定early/cancel两项已在6cf原生通过，c56真实搜索试读样本见顶部。不能由这些样本推导所有生产路径完成；以下“正在/当前”均限定原包时点。

## 3843792a 历史安装与修复前 PH76 取消失败

**`20260914T190706Z-3843792a-773d63a4`** 已在 **2026-09-14 19:09:12.959 UTC** 保数据安装到 VM `6460677a198b` 并启动。Harmony `3843792ab06ee1025d06d44d9666fbab2bd6f63f`、Core `0c5a3956274197578554f36b1a7fed9e1977ea78`，manifest两仓clean；261项Harmony检查、ArkTS、签名、身份准入、install/launch PASS。签名HAP **167841833 bytes**，SHA-256 `badce494ce3429906ff25c066d97a5e7babb58f8ad260a70f90350923b211f07`。证据：[manifest](search-flow-implementation/vm-3843792a/manifest.json)、[部署回执](search-flow-implementation/vm-3843792a/deployment.json)、[构建](search-flow-implementation/vm-3843792a/build.log)、[身份检查](search-flow-implementation/vm-3843792a/inspect.log)、[安装](search-flow-implementation/vm-3843792a/install.log)、[校验索引](search-flow-implementation/vm-3843792a/receipt.json)。

**384包时点PH76整体OPEN，取消后跨作业误归属由真实VM回调确认；当时生产隔离尚在修复。** 后续源码已实施，最新验证见顶部。两项是384同包不同受控运行，不能只取early成功而报全部通过：

| 实际运行 | 真实结果及证据范围 |
|---|---|
| early，03:10:57当地时间 | **PASS**：`callbackToMatchMs=4`、`matchedBeforePageEnd=true`。当前内存文档已准入，`early.css`真实回调在页面结束前被匹配；不是性能timeline模拟结果。 |
| cancel，03:11:29当地时间 | **FAIL**：旧作业7600001在`old.js`拦截后取消，新作业7600002开始；随后迟到`old.js`被记入7600002并实际`matched`，`returnedResource=unexpected`、`observedLateOldCallbacks=1`。这证明本次取消/新导航的资源归属隔离失败，不能继续当成仅fixture未准入。 |

[完整原生日志](search-flow-implementation/vm-3843792a/ph76-native-results.log)、[两条结构化结果](search-flow-implementation/vm-3843792a/ph76-native-results.json)保留所有事件与时间。两场景均为`in-memory-only`、真实ArkWeb回调受控样本；不证明真实书源联网、全部平台回调顺序或修复后的隔离已通过。专项根因与修复由PH76负责人另记，本节没有新增产品决策、生产修改或设备操作。

书签日期继续沿用**d5f13a96已经VM确认**的新旧显示和清理事实，不假称在384再次测过；6863/aa387其他验证也保留原包身份。Core未变化，沿用3837/3837正式门禁与既有Native；当前仍为iteration / `acceptanceEligible=false`，在线闭环、最终真机和用户验收不因包已安装而关闭。

## d5f13a96 阶段验证（历史包，日期实证保留）

**`20260914T185653Z-d5f13a96-803a4b82`** 已在 **2026-09-14 18:58:57.400 UTC** 保数据安装到 VM `6460677a198b` 并启动，install/launch PASS。Harmony `d5f13a965adf07e6c36fd8ad7e7315cf2ae7d686`、Core `0c5a3956274197578554f36b1a7fed9e1977ea78`，manifest两仓clean；261项Harmony检查、ArkTS、签名与安装身份准入通过。签名HAP **167841969 bytes**，SHA-256 `325cdd424b9dea2bb90ced607d87c5d3299f8248e8aa2376ac56ac76041d3004`。

[Manifest](search-flow-implementation/vm-d5f13a96/manifest.json)、[部署回执](search-flow-implementation/vm-d5f13a96/deployment.json)、[构建](search-flow-implementation/vm-d5f13a96/build.log)、[身份检查](search-flow-implementation/vm-d5f13a96/inspect.log)、[安装](search-flow-implementation/vm-d5f13a96/install.log)及[副本校验索引](search-flow-implementation/vm-d5f13a96/receipt.json)已归档。新Core正式门禁3837/3837、0 skipped、无LEAK，210 conformance/0 failed、drift0和C/C++smoke通过；首次因localhost端口权限失败的运行仍保留在下方Core门禁证据，不能冒称该次也通过。

**本包书签日期已补VM确认**：旧第17章显示“时间未知”，新增第18章显示“09-15 03:03”，与实际创建的上海当地分钟一致；随后清理第18章，列表仅保留第17章。[日期证据](search-flow-implementation/vm-d5f13a96/bookmark-time/receipt.json)。仅该日期/清理样本通过，**PH76实际回调结果仍OPEN**。 6863的书签保存/删除与PH88几何、aa387的胶囊及其他交互均保留原包身份，不因安装d5就算重复验证。此包仍为iteration / `acceptanceEligible=false`；在线动线、真机与用户验收不因此通过。

启动预检曾误用`sys.boot_completed`，返回参数错误1002；随后使用规范`bootevent.boot.completed`确认`true`，SceneBoard仍为PID1529。三份原始回执在上述索引中；这是操作参数错误，不登记为VM启动故障或HDC断联。

[后续Core门禁与Native证据](search-flow-implementation/ph86-time-final-gates/receipt.json)、[正式全量](search-flow-implementation/ph86-time-final-gates/ph86-time-core-final-unrestricted.log)、[环境失败原件](search-flow-implementation/ph86-time-final-gates/ph86-time-core-final.log)。

追加输入见 [PH43–PH47](FOLLOWUP_43_47.md)：用户在643bcaf5上纠正主题修复方向，并补充朗读预备、终宋书源和详情几何。原PH01–41及PH42编号保留；PH31旧处理明确撤回，新的代码/验证结论不与旧报告混用。

本轮反馈对应已安装的 `9509d4feb410ce559d67b77785e2248e88485f4e`，不是当前工作树 `4802ef4b`。安装 run `20260913T160039Z-9509d4fe-25529e1f`，signed SHA256 `b9ef64ece51c02c865ca1740fee52ca7efebe162495fb784fa000fae1aacf2fd`；[保数据安装及启动回执](../../.reader-artifacts/hap/20260913T160039Z-9509d4fe-25529e1f/deploy-physical-b1f20b88963d-20260913T170111Z.json)。用户人工审视提出39号编号，17和19各出现两次，合计41项，全部分别保留。

本文件是发现记录，不是修复或验收证明。优先审计现行代码、9509包对应代码、已有Figma/Make和历史约定；本轮不操作设备。代码修复、本地回归、新包、VM、真机、用户验收分开记账。旧未验证项继续保留在根 DEVELOPMENT_BACKLOG §11，本批不替代全量实施方案。

## 用户反馈原意与逐项归属

| ID | 原编号 | 现象/要求 | 审计归属 |
|---|---|---|---|
| PH01 | 1 | 亮度分配不均：亮度条上方四分之三过量，只有四分之一适合人眼，难以精准调整。 | root / brightness |
| PH02 | 2 | 自动亮度按钮只有手动状态能点击；已自动时点击无反应。 | root / brightness |
| PH03 | 3 | 能否先读取系统亮度范围，自适应将大部分条段分配给人眼舒适范围。 | root / brightness |
| PH04 | 4 | 亮度填充未严格裁切在圆弧内，极低值形成超出圆弧的横线。 | root / brightness |
| PH05 | 5 | 快捷控制栏设置页标题与选项重叠，标题显示不全。 | reading |
| PH06 | 6 | 除朗读外，其他所有快捷控制页外轮廓丢失。 | reading |
| PH07 | 7 | 主题库设置默认日夜阅读主题没有成功反馈。 | search/settings |
| PH08 | 8 | 快捷设置的小横条展开失效。 | reading |
| PH09 | 9 | 自动翻页和朗读实际动画时长过长。 | reading |
| PH10 | 10 | 胶囊展开与页数左移动作重叠。 | reading |
| PH11 | 11 | 胶囊出现时页数位置不稳定，有时回原右下角被覆盖。 | reading |
| PH12 | 12 | 胶囊与正文不同步，关控制栏后先正文再闪现胶囊。 | reading |
| PH13 | 13 | 下拉添加书签无反馈；原规划要求右上角书签动画。 | reading |
| PH14 | 14 | 书签列表没有正文内容，出现“偏移***”不明字段。 | reading |
| PH15 | 15 | 完整控制页底部边框不完整，内容与边框融合。 | reading |
| PH16 | 16 | 完整控制栏小横条收起失效。 | reading |
| PH17 | 17a | 书架列表右上设置图标功能接错。 | bookshelf/source |
| PH18 | 17b | 本地TXT标签错误显示为本地local。 | bookshelf/source |
| PH19 | 18 | 进度适当右移，与右侧更多保留间距，给书源名称留空间。 | bookshelf/source |
| PH20 | 19a | 书架列表更多图标过小。 | bookshelf/source |
| PH21 | 19b | 更多弹窗宽度按书籍封面到屏幕外侧的边距；底部圆角与直边并存，删除圆角部分。 | bookshelf/source |
| PH22 | 20 | 搜索历史居中，应该顶部对齐。 | search/settings |
| PH23 | 21 | 默认完整显示前两行历史，超过两行才折叠；按钮固定使用“展开”，不是“*条更多”。 | search/settings |
| PH24 | 22 | 搜索进行中样式和动效绘制错误，参考当前修改前版本，仅优化渲染。 | search/settings |
| PH25 | 23 | 搜索关联排序异常，“诡秘之主”搜索不到准确原版书籍。 | search/settings |
| PH26 | 24 | 详情最新章节/书源/分组高度字体统一为书源样式；实际章节字体错误；优先完整显示书源名称，换源按钮随名称长度在同一行移动并保留右边距，放不下才尾省略。 | bookshelf/source |
| PH27 | 25 | 简介/章节无内容或加载失败时提供文字说明。 | bookshelf/source |
| PH28 | 26 | 作者带“作者：”标注。 | bookshelf/source |
| PH29 | 27 | 书架标题与右侧按钮整行固定置顶，但缺乏明显轮廓。 | bookshelf/source |
| PH30 | 28 | 列表顶部下拉应刷新全部在线书籍最新章节；记录为规划/功能缺口。 | bookshelf/source |
| PH31 | 29 | 阅读主题色块与实际正文背景颜色不一致。 | search/settings |
| PH32 | 30 | 完整控制界面不应重复出现设置页的翻页动画和文本对齐；追溯错误修改来源。 | search/settings → reading |
| PH33 | 31 | 夜间字号/行距等控件的交互内容未做深色适配。 | root / control colors |
| PH34 | 32 | 通用设置内容居中；扩查同类页面滚动容器。 | search/settings |
| PH35 | 33 | 清理文字缓存文字超出按钮，核查宽度自适应。 | search/settings |
| PH36 | 34 | 通用设置返回应回主设置，实际回到书架。 | search/settings |
| PH37 | 35 | 深色开关关闭状态下滑块与轨道对比不足。 | search/settings |
| PH38 | 36 | 书源管理（原文“书院管理”）登录放在检测左侧，修正排版。 | bookshelf/source |
| PH39 | 37 | 书源标签不要与URL同行；小字标签放标题右侧，布局与换源按钮的约束一致。 | bookshelf/source |
| PH40 | 38 | 换源按钮控件和文字没有居中。 | bookshelf/source |
| PH41 | 39 | 完整目录文字颜色与正常文字不一致。 | search/settings |

## 已知包与源码差异

- PH22：`c398cafe`已改历史测量启动依赖和顶对齐，但未装入本次9509包；新提出的“展开”文案另行落实。
- PH41：`05c39cf7`及共享主题`aaaa0c53`已修强调文字误用夜间实体填充色，未装入本次包；仍需核查本次期望对应角色。
- 目录尾部锚`a0374fcc`与导入图标绘制比例`1921b84d`也未装入本次包，不从后续计划删除。
- 最新候选`4802ef4b`门禁失败：`test-reader-render-work.mjs:165`预期纠偏1次实际0次。只读定位为测试提取遗漏新增helper，尚未修复或重跑，不能记新包交付完成。

## 审计输出

分项报告：[亮度与控件主题](brightness-theme-audit.md)、[阅读控制、胶囊与书签](reading-audit.md)、[书架、详情与书源](bookshelf-source-audit.md)、[搜索与设置](search-settings-audit.md)。尚未定位的项维持OPEN，不以用户反馈本身猜测实现原因；不将既定设计要求再次归为用户待决。

4802打包阻断现已定位并修复为测试提取遗漏 `leadingAnchorIsAligned`，原纠偏断言保留并通过，见 [回归](render-work-gate-after.log)。上面的初始发现记录保留，不再代表当前状态。

## 顶栏边界的默认实施选择

PH29已向用户提出“保留固定加底部分隔线/整行随列表滚动”的可选澄清；等待期间未收到不同选择后，按已说明的建议实现：仅书架顶栏启用1vp底部分隔线，日夜使用已有App纸色/lineStrong，原58vp高度与固定归属不变；二级“我的书架”仍在List内。此为本轮用户轮廓反馈驱动的修改，不伪称Figma原有边框。

## 当前整合结果

以 [实施状态与新包回执](IMPLEMENTATION_STATUS.md) 为最终本地状态：232组检查、实际编译、签名和复验通过；仍有5项明确边界，新包未安装。初始发现及分报告冻结时点不再代替当前状态。

## 独立追加：PH42 多级目录适配

用户最新要求将“多级目录适配”登记为功能缺口。独立编号 **PH42**，不并入前述原41项反馈，也不改变PH01–PH41及其5项边界的历史统计。

- 状态：**功能缺口OPEN，未实施**。
- 范围：按用户“多级目录适配”的原始表述保留，待后续代码侧审计明确当前目录数据、呈现与交互的具体适配范围；本次不扩展审计，不预设折叠层级或实现细节。
- 产物边界：本项不包含在本次新包`20260913T182027Z-643bcaf5-1c85dc16`，不能因该包本地检查/编译/签名通过或后续真机安装而标完成。
- 本次仅登记文档；不修改生产/测试，不构建、不提交、不操作设备。真机安装由root独占执行，以其正式回执另行更新，登记不阻塞安装。原完整实施计划所有OPEN继续保留。

最新安装状态见 [实施状态末节](IMPLEMENTATION_STATUS.md)：643bcaf5已保数据安装并启动；PH42仅登记，未实施。

## 最新真机反馈：PH77–PH91（2026-09-14）

用户在本轮安装后报告以下15项。已确认最终真机安装包 run `20260914T154527Z-1d1f47e5-41357e27`，Harmony `1d1f47e5` / Core `61a2f86e7`，签名HAP SHA `1771b5ad75b42c6f56704adbf1f722788816dd840163ff5cda69adab99aa5def`；真机15:46:24 UTC安装/启动PASS，VM同包15:47:03 UTC安装/启动PASS，均保数据。现象来源是用户人工反馈，未取得逐帧/请求trace，不将其虚构为独立复现或唯一根因。先记录和代码审计，暂停原计划VM交互，待确定最小验证问题后继续；真机操作已释放。

| ID | 用户序号 | 现象/要求 | 范围 | 当前状态 |
|---|---|---|---|---|
| PH77 | 1 | 搜索加载缓慢，底部搜索动效数秒才变化一次 | 搜索/SDK/主线程 | 已去除大对象跨 Prop 深复制；真实 SDK 边界回归通过，设备耗时/帧率待验证 |
| PH78 | 2 | 约30秒完成30个书源，目标书2分钟未展示 | 搜索调度/来源/候选发布 | Core 私有轮转队列改共享 FIFO，慢 worker 不阻塞其他空闲 worker；正式回归通过，真实来源耗时待验证 |
| PH79 | 3 | 正在搜索时全应用卡顿，翻页等数秒 | 共享执行/锁/渲染 | 已修 Prop 复制及 PH90 全局锁阻塞路径，本地通过；不能宣称解释全部物理设备卡顿 |
| PH80 | 4 | 删除历史搜索展开功能 | 全部历史直接展示；保留滚动 | 已删除折叠和测宽，全部历史直接展示；VM无展开入口，长历史滚动未专项验证 |
| PH81 | 5 | 进入搜索时直接唤起输入法 | 搜索入口焦点/键盘生命周期 | 已接一次性布局后焦点，离屏/返回不抢焦点；VM重入自动唤起输入法通过，首次冷进入精确延迟未验 |
| PH82 | 6 | 搜索框光标像左括号而非竖线 | 输入控件/绘制与焦点 | 旧包VM复现原生圆角裁切及隐藏Web抢焦点；修复后VM正常竖线通过 |
| PH83 | 7 | 详情目录预览不应仅4章，历史为20或30且可翻动 | 已确认历史20章及内部滚动 | 已恢复20章Scroll；VM已滚动至第20章，准确点击第20章的设备验证未单列 |
| PH84 | 8 | 详情完整目录误接阅读完整控制栏目录 | 已定外部完整目录入口 | 已直接挂外部目录，不先解析正文；VM外部入口及返回详情通过，保留原外壳历史样式 |
| PH85 | 9 | 《鸣龙》松鹤阅读正文残留方括号及字面反斜杠r/n等 | 原始数据类型/源规则/规范化 | 已修 JSONPath 数组文本提取，正文格式升2并沿 PH75 保护位置；Core 回归通过，原书呈现待验 |
| PH86 | 10 | 常态无书签不显示图标；已有书签才显示填充；镂空仅下拉反馈且不入正文 | 沉浸顶层书签反馈 | 6863 VM新增/约40秒稳定/列表可见/删除闭环通过；稀疏图不证明全动画。6863日期仍为01-01 08:00；d5新旧日期显示/清理样本已VM通过 |
| PH87 | 11 | 阅读更多新增下载全部章节；弹窗缺指向凸起、应右对齐且宽度适应文本 | 复用离线下载；对照Figma菜单 | 已接下载全部、右锚菜单/凸起/文本宽度；VM稳定外观及本地书禁用通过，在线全部下载业务未验 |
| PH88 | 12 | 亮度/自动按钮没有对齐轨道上下圆角圆心，轨道偏短 | 几何共享/用户明确增长轨道 | 已改38×190/104轨道/19、171圆心并扣除边框内缩；6863 VM快捷稳态端点每轴误差仅0.5px，符合取整；未拖亮度或点自动 |
| PH89 | 13 | 自动翻页胶囊内部元素高度不齐，倒计时圆形轮廓形变/尺寸和文字高度错误 | 胶囊布局/用户明确16×16圆 | 已改圆与数字16×16、标签高16、24高行居中；VM稳定几何/暂停/停止通过，首次交接及全程帧率未验 |
| PH90 | 14 | 完整内容搜索打开后卡顿，键盘延迟，后续点击无响应 | 内容搜索扫描/共享锁/原生列表/输入 | 一致快照分批扫描释放全局锁；去二次方查找/Prop复制；本地50/2000/10000回归通过；VM输入、结果滚动及转换终态通过，精确中途paint/帧率未验 |
| PH91 | 15 | 内容搜索快/完整两处重复搜索图标；输入框内不应有图标；右侧按钮颜色和轮廓异常 | 共享搜索输入和按钮主题/Figma | 已删除框内重复图标、恢复右侧单图标及青色资源角色；SDK与VM所测日间快/完整态通过 |

本次用户明确删除展开，覆盖旧“两行+展开”规则；书签显示按本次明确状态规则执行。目录数量/外部入口查已有规划；视觉问题先对照Figma，不把过去错误实现当设计基准。不关闭§16联合VM/帧率/用户验收。

PH82 的初始代码审计无法区分 caret、选择手柄与圆角裁切，随后在已安装旧 run `20260914T154527Z-1d1f47e5-41357e27` 做了最小 VM 取证：空输入左边界 caret 被原生默认圆角裁成月牙，非空末尾为直线；同时发现隐藏 Web 可抢焦点。见[空输入截图](search-flow-implementation/ph82-focused.png)、[有文字截图](search-flow-implementation/ph82-text.png)、[固定上游绘制源码](search-flow-implementation/ph82-text-field-overlay.cpp)。修复为 ReaderSearchField 两个 TextInput 及内容搜索唯一 TextInput 内部 `borderRadius(0)`，外层圆角不变；ArkWeb 的 `focusable/focusOnTouch` 仅随 interactive 开启。[SDK 回归](search-flow-implementation/ph82-native-focus-test.log)通过，新包原生像素/输入法仍待 VM，旧包复现不代替修复验收。

### PH77–91 当前整合身份与证据边界（2026-09-15）

Core 已提交 `28369db9405822f4b8277eb95ad94057f177b7bb`；[官方检查](search-flow-implementation/ph77-91-core-official-final2.log)3832项测试通过，其中1项标记 leaky，为退出后输出管道未及时关闭的警告，非应用堆泄漏证明；[独立复核及未决边界](search-flow-implementation/ph77-91-leak-summary.json)保留，未放宽超时。新 Native [构建](search-flow-implementation/ph77-91-native.log)完成，[身份](search-flow-implementation/ph77-91-core-build-identity.json)为 clean/release，buildId `5ffa51028024982bce9a607e5c3c88b69126d709e980a2823e1e7d2888f6c3fd`，已同步 Harmony 受版本管理的 `.so`。

上一阶段取得正式 VM 部署回执的包是 **`20260914T182625Z-6863af5d-ded2e152`**（Harmony `6863af5d4e9c5dac34e3ca74b120a7d5daa2952e` / Core `28369db9405822f4b8277eb95ad94057f177b7bb`），261项Harmony门禁、ArkTS、签名及VM保数据安装/启动通过；18:28:21.450 UTC完成，targetRef `6460677a198b`，HAP SHA `3df455f5b6f0d13bafd09f2d15c3e3c456efc1642eb54ba6b8ccc103db2e0b8f`。见[manifest](search-flow-implementation/vm-6863af5d/manifest.json)、[回执](search-flow-implementation/vm-6863af5d/deployment.json)及[分包VM记录](search-flow-implementation/VM_VALIDATION.md)。aa387的先前部分交互、646e8634发布顺序修复、acbea857仅构建未部署均保留为各自历史；不得把它们改成6863重复验收。Core未变，沿用同提交3832项官方通过（含1 leaky）的门禁；6863仍为iteration，不代表全部计划或用户验收通过。后续日期修复若产生更末版包，须另绑回执，不能倒写6863。

原因与正式回归入口：PH77/79 的 `SearchPublication` 稳定 holder + revision 修复真实 ArkUI Prop 深复制，见[属性边界证据](search-flow-implementation/ph77-79-publication-boundary.json)及 `test-search-publication-boundary.mjs`；PH78 的源 worker 共享队列见[阻塞回归](search-flow-implementation/ph78-shared-source-queue.log)。R8 空队列有等待、连续即时轮有让出，未发现无等待 busy-loop；FIFO不保证来源完成顺序或网络耗时。PH80/81 见 `test-search-history-layout-lifecycle.mjs`；PH83/84 见 `LocalBookDetail`、Index外部目录分支及 `test-detail-external-directory.mjs`；PH85 见[规则与格式升级报告](PH85/REPORT.md)，普通旧缓存不自动升级、歧义保留旧文旧位置。PH86 的顶栏槽/手势/ACK见 `test-reader-bookmark-top-info.mjs`；PH87见 `test-reader-more-popup.mjs`；PH88见 `test-reader-brightness-perception.mjs`；PH89/91见 `test-reader-physical-control-details.mjs`。16×16圆覆盖旧 Figma 1164:10275 的18×16椭圆，增长亮度条也是用户明确要求，不重新列为产品待决。

PH90 Core 在源/正文/处理配置一致快照后释放全局 publication 锁，分批扫描、取消并返回前校验，防止错误 positionScope。桌面生产 C ABI 探针中并发进度等待约293ms降至约0.7ms，只证明该锁链解除，不证明真机全部卡顿消失。Host 去二次方查找、稳定发布与焦点修复及原生 List 主链详见[专项证据](search-flow-implementation/ph90-content-open.md)。72vp仅为内部坐标标尺，实际54→72行高及14/10字号不变；完整数据源不截短，使用真实 native offset 回执补偿并复用既有 scroll policy，每侧缓存2行。`test-reader-content-search-native-list.mjs`覆盖50/2000/10000、深偏移往返、负origin、追加/替换、迟到回执和用户中断；SDK探针注入8个请求索引只证明按需生成，不能当Ace可见范围或native paint验证。新包真实 materialization/回执/paint同帧、触摸和帧率仍待VM；[最小清单](search-flow-implementation/ph77-91-vm-minimal-checklist.md)明确现有pilot不是2000行内容搜索样本。

失败历史继续保留：Core [初轮](search-flow-implementation/ph77-91-core-official.log)/[中间轮](search-flow-implementation/ph77-91-core-official-final.log)、[旧迁移fixture失败](search-flow-implementation/ph77-91-migration-fixture-failure.json)、[回放字段差异](search-flow-implementation/ph77-91-host-replay-fixture-delta.json)，Harmony [第一轮](search-flow-implementation/ph77-91-harmony-check-first.log)/[第二轮](search-flow-implementation/ph77-91-harmony-check-second.log)/[第三轮](search-flow-implementation/ph77-91-harmony-check-third.log)。第三轮旧探针引用已移除的 `resultRowsHeight`，最终探针已接List主链，未用无效方法兼容测试。以上本地检查与旧包VM复现均不关闭新包VM、真机或用户验收。

PH77–91 首次 HAP 编译失败：260 组本地检查通过后，正式 ArkTS 编译拒绝新增 TS 文件导入 ETS 类型（SearchPublication、ReaderContentSearchPublication、ReaderPageChromeTextMeasurement）；新增 List DataSource 的 ArkUI 全局接口在 TS 文件中也不可见。该模块归属/共享类型错误已在aa387f08纠正，后续正式编译通过；不放宽编译或测试，不改功能要求。原始日志 `search-flow-implementation/ph77-91-hap-build-first-failure.log` 已保留；本次没有生成发布 manifest、没有安装。

### VM追加验证的实际边界

- 在线《鸣龙》本次109个来源失败，106次地址准入拒绝、3次缺少searchUrl；目标VM将www.zongheng.com解析为198.18.0.189，被现有安全策略拒绝。不能将这3.357秒当在线搜索性能通过，也不放宽安全规则。来源预解析、松鹤真实正文及搜索→换源→试读闭环仍OPEN。
- PH90完整收起回首条的初判已撤回：按用户既定执行参考196–214，搜索终态回顶是预期；保留中途连续性/重抓的本地证据和原生精确paint未验边界，不增加新需求。
- PH86正常动画探针发现ACK/projection先于回弹完成可二次反转，已在978d29f1修复，6种顺序/12次生命周期本地通过；旧VM稳定画面缺标记未获得对应落库ACK，不能声称已定位唯一原因。
- PH76原生early首次超时已记录；诊断自己生成的主文档原来被provider拒绝是可证实缺口，已修精确文档准入及拒绝日志，最终原生early/cancel结果待新包重验。

### 6863af5d 书签新增/稳定/删除的本包实证

18:30第18章第3页下拉新增后出现填充书签，39.790秒后的静止采样仍保留；18:32书签列表有原第17章和新增第18章两条记录及正文摘录。选择第18章后再次下拉删除，阅读图标消失，18:39重开列表仅剩第17章。原图/节点/命令时间及SHA见[专项回执](search-flow-implementation/vm-6863af5d/receipt.json)。该样本支持应用内保存与删除闭环，不代替连续手势动画、重启后持久性、真机或用户验收；aa387旧缺图标现象与缺少对应ACK的边界不撤销。

6863列表中的`01-01 08:00`日期问题仍在。独立[日期审计](search-flow-implementation/ph86-bookmark-time-audit.json)定位旧Core缺省time采用递增键、Host直接Date；不能把它笼统说成秒/毫秒换算错误或据小主键认定书签内容损坏。后续Host已补无法证明为现代毫秒时间时显示“时间未知”的本地回归，Core新缺省真实时间在另一切片处理；旧主键/排序/备注/正文/偏移保留。本包不包含该新日期效果。PH76本包结果未记录前继续OPEN，不由书签闭环推断资源回调或在线搜索通过。

PH88的6863快捷稳态截图/原生bounds已归档：[几何回执](search-flow-implementation/vm-6863af5d/ph88-receipt.json)。外框133×665px、轨道28×364px对应38×190/8×104vp，上下图标中心与端帽圆心每轴差0.5px；仅几何样本通过，亮度拖动/自动按钮/其他尺寸与连续响应未测试。日期/PH76未因此关闭。
