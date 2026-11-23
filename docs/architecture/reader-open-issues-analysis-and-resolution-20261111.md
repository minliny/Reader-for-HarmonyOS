# Reader 未完成遗留问题：详细分析与解决方案

日期：2026-11-11。承接[全量审计](/home/administrator/Reader/Reader-for-HarmonyOS/docs/architecture/reader-delivery-full-audit-20261111.md)，仅深化本轮 HarmonyOS 框架、下载／漫画、准入与交付遗留。Host 生产基线仍为 `641be0ab`，Core 为 `d3eb4972`；上轮报告文档和 Core 治理 WIP 保留。本次没有执行产品测试、SDK 验证、构建、验签、设备操作、SQL／FFI 或原意图内容读取。

后续用户明确“全量修复”后的实际代码、检查和交付进度见[实施记录](/home/administrator/Reader/Reader-for-HarmonyOS/docs/architecture/reader-residual-repair-implementation-20261111.md)。本文是修复前的分析基线，原状态／未执行描述保留其时点；不将后来局部PASS追认到原设备或历史因果。

## 1. 当前状态与处理结论

**剩余工作的中心是完成合法交付、修复确定的状态边界，以及恢复可验收的业务链。** `0511` 编译及指定签名通过但从未安装，原 VM 仍是 `a443`。正式 inspect 的 `FAIL / exit 3 / target-sqlite-version-unresolved` 仍有效；后来一次只读诊断只定位到当前 `lineage-log-empty`，没有形成新的正式准入。

上轮 F01–F11 仍未完成生产修复／验证，F12 仅文档披露已补正。本报告进一步定位了已有 UI-C9 中的漫画页码水合遗留，独立记为 L09；它不是历史 0/2 成因已经查明。下表按解决工作分组，同一个 finding 和交付缺口可能归入同组，**组数不代表独立事故数量**。

两项执行顺序需要修正：

1. **F08 指纹域升级可独立推进，不应作为所有修复和交付的强前置。** 现有 core.info 已能给出版本（或缺失）及 build identity；Cargo.lock 摘要也有独立字段，只是当前 same-source 路由不比较。解决空日志不必顺带重构指纹协议和 Native。
2. **当前 owner 观测先证明通信可行性。** 已审代码尚未证明存在可供 CLI 被动查询、不会激活应用的端口。普通 Want／aa start 即使先查 PID，仍可能因检查后进程退出而冷启动。nonce、TTL 和 generation 是响应合同，不能替代真实的通信认证和不激活保证。

## 2. 遗留总表

| ID | 遗留及对应原编号 | 性质／状态 | 是否阻断本轮交付 |
| --- | --- | --- | --- |
| L01 | 当前版本／来源无法证明，0511 未安装；F01/F04/D01 | 实际交付阻断＋设计缺口 | 是；需正式准入，不能用诊断预测代替 |
| L02 | 消息边界和当前会话不足；F02/F03 | 确定源码缺口，未证实误放行 | 新控制器开放该来源路径前必须修；冻结 transition 路径另计 |
| L03 | 重验不对称、ABI／UID fence 缺失；F06/F07 | 确定源码缺口，无本次异常事实 | 对将采用的安装路径必须有明确保护 |
| L04 | 查询失败折叠、远端退出码未知；F05/F10 | 诊断能力缺口 | 可独立本地修；不需先改 Core |
| L05 | header 读取前 no-follow 边界不足；F09 | 确定读取边界缺口，未证实实际泄露 | 再次使用相关读取前必须处理或不执行 |
| L06 | TTS 失败退休后迟到取消；F11 | 分支确定，实际活性后果待证 | 先局部验证；不预设需要设备或大改 |
| L07 | 漫画当前没有有效离线候选；D04/UI-C9 | 真实业务可用性缺口；当前 0/2 与克隆事实一致 | 阻断漫画离线冷续读，不必阻断文字交付 |
| L08 | 历史 2/2→0/2 的时间／责任链；D05 | 因果 UNKNOWN | 不以猜测结案；不作为所有修复强前置 |
| L09 | 漫画页码水合失败后同签名不再试；UI-C9 | 已有开放项的进一步源码定位 | 可独立 Host 修复；与离线计数分开 |
| L10 | 新包阅读像素及部分动态行为；D02/D03/UI-C11 | 验收证据未完成 | 新候选对应层的交付条件 |
| L11 | 原 UNKNOWN 操作结果；D07 | 业务事实未证明 | 不能承诺已确认；不因图像验收隐式结算 |
| L12 | 322 条警告的剩余处置 | 风险清单，不是 322 个已证故障 | 不要求清零；实际触达边界按风险处理 |
| L13 | 旧 fixture／未审 sibling 的资格 | 测试可用性和证据缺口 | 仅阻断将要选择的具体检查 |
| L14 | 存储指纹域与有效依赖闭包不等价；F08 | 兼容性判定设计债 | 当前无实际不兼容证据；独立演进 |
| L15 | 完整回归、物理机、用户验收；D06 | 未执行／未制定本次集合 | 不能声称整体完成；先定义范围 |
| L16 | 工具路径、ledger、异常终止的信任边界 | 条件性运维边界，无本次事故 | 不统一绑新 Core；按实际威胁模型处理 |

## 3. L01：当前交付为什么还卡住

### 现象与根因边界

正式 inspect 未取得 `targetSqliteVersion`、`installedStorage`、`versionSource`，因此正确拒绝安装。后续只读范围内，按 PID 与宽 Reader 日志的 HDC 客户端均 exit0／stdout0／stderr0，读取前后单一数字 PID 稳定；header 同次无版本，较后 marker 才见 WAL 非空。远端 hilog 退出码、空日志机制和旧 inspect 全部子原因仍未建立。

[正式路由](/home/administrator/Reader/Reader-for-HarmonyOS/scripts/lib/hap-storage-admission.mjs:84) 需要实际版本及合法来源／正式 transition。header 47 不能独自证明 source；启动日志有过 ready 也不能证明当前 owner；非空 WAL 拒绝 header 是保留的保护。不能靠清 WAL、固定填 47、旧日志或 Linux debug 返回值放行。

### 可执行解决路径

**路径 A：交付冻结 0511。** 保持两个已绑定 controller 字节不变，准备新鲜停态 DB/WAL 的正式 Library47 clone 证明；绑定准确目标、UID、签名、updateTime、ABI、源 pair、HAP、Native、controller 和实际执行记录。原应用在复制后到替换前最后校验保持停止；中途启动／pair 变化使证明不能继续使用。inspect 与 canonical install 两次都带同一准确 `--storage-transition`，不能只给 inspect 传入。冻结A的canonical install必须显式带`--no-launch`，再核对UID／签名／版本，之后才按新明确范围启动；旧pipeline默认立即启动，不能省略此参数。此分段安装／启动方案须在后续具体授权中明确，当前报告不执行。

本次只读复核收窄了一项前置：0511 provenance 指向的 Core 输入快照（SHA256 `6a5afe98578480196b58071d6e19580057d57f7ea8915208f49a48d79bae20ae`）中，两份正式测试定义、Cargo.lock、build.rs 的记录与当前四文件字节一致。**这只是有限输入记录匹配**；完整相关输入／feature/profile、工具链可执行性、证明组装器和新数据结果仍未核验，不能记新proof PASS。正式FFI验证会正常打开／写入私有副本，不等于“全程没有数据库写入”；原库不执行SQL，不取回原Host UNKNOWN文件。细节见[准入遗留审阅](/home/administrator/Reader/.local/framework-closure-implementation-20261111/residual-analysis-20261111/admission-residual-review.json)。

**路径 B：后续候选。** 先确定所需修复，再冻结新的控制器／应用产物身份。若引入 current-owner 观测，先完成被动通信设计；现装 a443 没有该端口，第一次更新仍需要既有合法兼容边。不能强装来启用端口，再用端口追认刚才的安装。

**退出条件：** 实际 canonical inspect allowed，精确候选保数据安装回执、UID／签名／版本身份成立；启动接受、页面可用、Runtime published 分开记录。日志不可观测就保留 published 未确认，不预设重启会修好日志，也不重复停启求证。原来所有复制／安装／诊断范围已关闭，本报告不续期。

依据：[正式失败](/home/administrator/Reader/.local/framework-closure-implementation-20261111/final-vm-0511/result.json)、[当前只读观察](/home/administrator/Reader/.local/framework-closure-implementation-20261111/storage-admission-live-20261111/observation.json)。A 路线的三个 Rust 入口、五项合同事实及 clone 环境防 synthetic 回退条件见[实施方案 A2](/home/administrator/Reader/Reader-for-HarmonyOS/docs/architecture/reader-delivery-remediation-plan-20261111.md)。

## 4. L02/L03：正式判定和安装身份的最小修复

### 触发链

- [旧正则](/home/administrator/Reader/Reader-for-HarmonyOS/scripts/lib/hap-storage-admission.mjs:58) 只约束身份／ready 文本末尾，可能接受普通消息内嵌后缀；新诊断宽日志计数器的修复没有改变 canonical 解析器。
- [lineage](/home/administrator/Reader/Reader-for-HarmonyOS/scripts/lib/hap-storage-admission.mjs:48) 只比较数字 PID，缺 owner 代次／关闭失效合同；历史匹配坏 JSON 又会否决后来的正常会话。不能以跳过坏行作为修复。
- [resolveDeployment](/home/administrator/Reader/Reader-for-HarmonyOS/scripts/hap-pipeline.mjs:2083) 在 header 成功时只重读 header，未对实际使用的 lineage 对称重验；仅 transition 有替换前 callback。
- [same-source 路由](/home/administrator/Reader/Reader-for-HarmonyOS/scripts/hap-pipeline.mjs:1939) 未比目标 ABI；[安装后](/home/administrator/Reader/Reader-for-HarmonyOS/scripts/hap-pipeline.mjs:2167) 未显式要求 UID 与安装前一致就可能启动。

### 修改边界与验收

由唯一控制器 owner 修改，不与诊断 owner 同时修改共享读取器：

1. 先决定日志是否继续拥有正式准入权。推荐后续使用一套可认证的当前来源观测和正式proof后备，日志只作诊断；若退出日志authority，就移除其正式调用链，不必再维护第二套正式会话解析器，也不能仅靠文档声称已退役。若暂时保留正式日志路径，则必须先解析 OS 前缀及可信进程元数据，消息体从固定 token 开始，再校验 schema／顺序／会话；嵌入、跨 PID、截断、旧会话均拒绝。严格诊断计数仍不拥有准入。
2. 定义所有实际依据的 validation handle；替换前重验 BMS、版本、来源、进程／owner 实例和失效条件。无法证明当前会话时保持拒绝／转正式 proof 路径，不能把“同 PID”升级成完整当前性证明。
3. 替换前校验 ABI；既有应用更新后、启动前校验 UID 保留及准确签名／版本／build 身份。缺失、不一致就停在实际状态，不卸载、不清数据、不自动换包或目标。
4. 命令级 server lease、目标锁和 run 锁各司其职；不套用会等待自身的嵌套 lease，也不承诺阻止所有外部操作者竞态。

**必要局部情景按保留路径选择：** 若保留正式日志路径，验证正常记录接受、嵌入／旧ready／closing／换代拒绝、header不变而lineage改变拒绝。若日志已退出authority，则验证正式调用不可达、日志内容不能改变allowed，不要求重建第二套正式日志解析器。所选正式路径还需验证重读错误与内容变化分别记原因、ABI／UID缺失／变化拒绝、候选或controller不匹配拒绝。测试调用实际生产方法，不能复制判定算法自证。

这些是后续控制器修复。若仍先交付冻结 0511，不在其检出中直接修改绑定文件；其正式 transition 路径及外层 ABI／UID 校验按独立范围执行，不以此宣称遗留正式解析器已修。

## 5. L04/L05：诊断与读取边界可以独立完成

### L04 的最小闭环

当前 `optionalQuery` 把 timeout、spawn、非零退出等折为空字符串；独立诊断已保留 HDC 客户端结果，但[exitCode](/home/administrator/Reader/Reader-for-HarmonyOS/scripts/lib/hap-storage-admission-diagnostics.mjs:27) 不包含远端程序状态。

先在工具层分出 `clientExitCode/clientOutcome` 与 `remoteExitCode/unknown`。确有需要时用固定、有限、nonce 绑定的远端收尾协议；只接收完整匹配帧，缺帧、伪帧、截断、timeout／limit 的部分输出保持 unknown。原 payload 长度仍取原 Buffer，原内容不落盘。旧回执不能追填远端状态，diagnostic complete 不等于准入 PASS。

检查只需假 runner 的有限正反例；**不需要先升级指纹、重建 Native 或再操作 VM**。测试入口、嵌套、预算和必要性在实施前登记，未实施的情景不写成已通过。

### L05 的最小闭环

[旧 header 调用](/home/administrator/Reader/Reader-for-HarmonyOS/scripts/lib/hap-storage-admission.mjs:25) 在 od 前未建立 DB leaf no-follow 边界，后置 marker 不能撤回前面的读取。仅在 marker 增加 `test -L` 不能关闭问题，前后检查也不等于原子 no-follow。

优先顺序：

1. 明确安全路径、文件归属、普通文件／非 symlink 和并发替换假设；复用平台已有安全能力，不自研通用文件访问引擎。
2. 无法在读边界证明安全时，**canonical 首次 header 和补充读取均不执行**，分别记录未执行／版本 unknown；不能先调用旧读取器再取消 marker。
3. 若改 standalone 诊断而保留冻结 canonical 字节，要明确该次旧读取没有运行，不能伪造“与 canonical 完全同输入”的预测。
4. 只有安全条件成立才保留 WAL／journal／stat 前后稳定检查；不能为了求版本打开第二条原库 SQLite 连接。

**退出条件：** 合成 symlink／权限未知／路径不安全样本无法到达读字节；正常受控文件保留预期读取；报告无原始输出。正式共享读取器由控制器 owner 独占修改，诊断 owner 只管其调用准入和报告。

记账分层：安全拒绝使“读字节动作”未执行，不等于所选检查完成。若已选择的正式检查缺少所需能力／结果，仍是FAIL／未完成；不得把它降成可省略NOT_RUN或把unknown记为PASS。

## 6. L06：TTS 是先验证后修复的条件风险

[close](/home/administrator/Reader/Reader-for-HarmonyOS/entry/src/main/ets/platform/tts/HarmonyTtsBackgroundSession.ts:172) 在 stopOwnedTask 失败后仍可能成功 off；taskId／static retiring 保留，取消监听却消失。如果平台随后取消旧任务，之后对不存在任务的 exact stop 又一直报错，后继 owner 可能被退休状态挡住。该分支既有，未证明本次真机触发，不能直接报“朗读坏了”。

先用实际类和受控 SDK port 验证：stop 失败→off 成功→迟到 exact cancel→后继 activate；另确认目标 SDK 对不存在 task 的准确契约。若风险成立，最小修复是在精确任务结算前保留监听，或使用权威的 exact-task 已不存在证明结算；不能清空 ID、吞错误或 stop-all。

保持能力检测、请求代次、迟到 ACK、同 task cancel 证明和失败传播。无能力／无任务／stop 失败／off 失败／旧取消误投都要有有限情景。方法与 SDK 契约能关闭的先本地关闭，只有具体平台未决才另定设备问题。

## 7. L07/L08：漫画计数、业务恢复和历史归因分别解决

### 当前 0/2 与可用性

新停态数据在 Linux debug Runtime 打开前，目标 heads／retention／receipts 已为 0，manifest3 与 evicted3 身份集合相同，chapter_cache／metrics／INNER JOIN 均为0；两章 missing、无 version/candidate，目标事实在该 bootstrap 前后相同。旧第1章 Host 六个登记文件完整，不能替代 Core 当前有效准入。

因此当前没有把 count 改成2的依据；**“0/2 符合当前复制事实”也不等于用户离线能力已经恢复**。0511 的负缓存、revision 和 capacity 修复尚未上 VM，且不会自动重建旧 heads／receipts。

恢复业务的工作顺序：

1. 固定目标书／当前目录身份、需恢复的章节范围及用户保留要求；只用授权数据，先保留现有文件和事实。
2. 审阅是否已有受支持的重验／重新登记流程；存在就复用其 Core/Host 准入。若没有，使用既有下载 owner 的正常重建流程，先明确网络来源可用性、pending tombstone、版本身份和失败恢复，不直接 SQL 补头或改 evicted。
3. 正常协议产生有效版本后，依次验证 Core state/version → manga.entry 的 chapterId/version → Host manifest／登记文件完整性。旧文件存在不能跳过这些步骤，也不能未经验证写 complete。
4. 真实 candidate 满足 localComplete 后才冷续读，检查位置和退出持久化。没有 candidate 继续 NOT_RUN；若源不可用且无支持恢复入口，保留待恢复并制定单独业务适配，而不是伪造完成。

该恢复有下载／资源／数据库业务写入，必须是新的明确业务范围，不藏在只读诊断中。漫画恢复可与文字交付分开，不强迫修改 Core schema/count/migration。

### 历史 2/2→0/2

旧 09:07 谱系的探针作用于已被 Runtime 打开过的后继工作副本，只说明那份旧数据第1章 cached。当前复制数据不同；旧 Core max38 与当前47也不能构造公平内容差分。已找到无压力 capacity 缺口只证明该旧代码可能错误 claim，不证明它生成了现有 evicted 行。应用正常恢复启动可能写入，不能因 agent 未执行原库 SQL 就排除其贡献。

只整理既有快照、startup、claim／commit、Host maintenance 回执，寻找能绑定章节／版本、前后状态、时间及 owner 的证据。若表和回执没有这些字段，停止推测，保留 `HISTORICAL_CAUSE_UNKNOWN` 并明确已排除／未排除范围。新 owner 端口和指纹升级不是历史调查前置；现在追加设备读取也不能复原已经丢失的历史。

修复以后可沿现有存储 owner 增加必要的**脱敏原因码／操作身份及代次回执**，用既有日志／回执基础设施记录将来的 claim/commit，避免另建通用审计系统。新增未来记录不能追认过去因果。

## 8. L09：漫画页码水合的具体缺口及最小修复

### 已有现象的证据限制

旧 a443 初始书架有页码摘要，启动后首个树中 continue 卡页码缺失，隐藏 list 分支有“尚未阅读”，同时章级进度100%。隐藏树节点不等于可见像素；100%是章级比例，不等于页级位置。该观察不能证明进度丢失或冷续读失败。

### 当前源码的确定分支

1. [useOwner](/home/administrator/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/presentation/MangaBookPresentation.ts:22) 换 owner 时清内存 positions/tokens，是合理的会话隔离。
2. [hydrate](/home/administrator/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/presentation/MangaPositionHydrator.ts:73) 先 project，再在异步读取之前把 signature 写成“已处理”。同 signature 后续调用直接 return。
3. [project](/home/administrator/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/presentation/MangaPositionHydrator.ts:108) 的异常被当作可选展示失败吞掉，但不把该签名转为可重试状态。entry 抛错不会走 progress fallback；只有成功读到 null／admitEntry=false 才尝试 progress。失效返回也不建立成功事实。
4. [label](/home/administrator/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/manga/presentation/MangaBookPresentation.ts:121) 把 undefined 映成“尚未阅读”；[ShelfBookPresentation.visible](/home/administrator/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/bookshelf/presentation/ShelfBookPresentation.ts:60) 又把无 position 用于 unread／reading 筛选。尚未读回、读取失败、权威确认无位置被混成一种状态。

消费者必须准确区分：[正常主书架](/home/administrator/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/bookshelf/ui/BookshelfPage.ets:1701) 在该本地调用传的是`all`或使用serverFiltered结果，不能据此直接认定主书架筛选错误。[多选页](/home/administrator/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/bookshelf/ui/BookshelfMultiSelectPage.ets:363) 实际传入stored readingFilter，其hasBookKey／全选依赖visibleBooks，且未订阅readerMangaPresentationRevision；这里还存在迟到水合后重算／选择身份一致性的源码风险，未复现实际误选或丢选。

**结论：同签名失败后不重试及展示事实状态不足是源码缺口；尚未证明旧现场一定由此分支导致。** 其用户影响可能包括页码不显示、未读文案及阅读状态筛选错误，不能仅当作截图缺失。

### 行为保持的解决方案

- 沿现有 presentation/hydrator owner 区分 unknown、loading、confirmed-none、confirmed-position、retryable-failure。真实 `progress.location=null` 经 token 准入后才确认无位置；unknown/failure 不当作确认未读，也不推导已读。
- signature 用于同身份去重和进行中请求，不代表成功。每本书记录该代次结果；只有成功准入的位置／权威空结果才复用。失败仅允许后续正常 visible/reload 触发一次有界重试，避免每次 project 重绘自激重试。
- 保留24候选、2并发、书架144保留切片及原continue/detail例外、owner/mounting/navigation/shelfGeneration/current、progress token／revision 栅栏。旧 finally／旧失败不能清新代成功状态，旧 owner 的值不能泄漏到新会话。
- 明确多选页是否沿现有revision订阅重算；保持用户已选择的实体身份及既有筛选／reconcile合同，不能因暂时unknown就误清选择，也不能让迟到结果默默新增选择。全选、初始长按选择和提交前实体准入一并核对。
- owner 变化可以清空旧位置，但不能立即显示确定的未读事实。优先复用现有局部加载／空态语义；若修改用户可见提示，按消息框架归类登记，页面不新增 Toast／自建消息外框。
- 不从章级100%合成页码，不写 Core progress，不由展示层创建 candidate／恢复离线版本，不增加全局轮询。

**必要情景与退出条件：** 核心反例必须固定owner、mounting、navigation、shelfGeneration、route和candidate identities全部不变，首次entry失败后下一次正常visible回调可以恢复；真实旧源码在此反例必须失败。仅测试会推进shelfGeneration的reload不足以证明修好同signature问题。另验证首次成功、entry=null后progress成功、权威null、旧代失败晚到、旧代成功晚到、重复可见请求不并发放大、不由project重绘自激重试、unread/reading不把unknown当事实、多选页迟到水合／初始选择／全选／提交身份一致；均通过实际hydrator/presentation／消费者方法。先本地复现、修复并回归，最后才补新候选像素；本次未运行这些情景。

依据：[原观察边界](/home/administrator/Reader/.local/ui-goal-remainder-20261109/final-visible-handoff/controlled-pixels-20261110/manga-shelf-summary-after-restart.json)。

## 9. L10：阅读像素和动态行为怎样补齐

目前0511没有原生像素。a443 的两张日间、当前字号文字图只能证明该旧候选当时静态效果；标题505px仍省略，不能证明完整显示／改善量，夜间、其他字号、动画中间态没有相同证据。

补证分两层：

1. **最小候选交付：** 合法安装后从真实书架进入既有本地文字书一次，面板开关一次，最多两张准确候选阅读图；核对标题可用区、换源弱色／禁用、遮挡、实际几何和正常返回。长标题能否省略按产品约束判断，不把“完整显示所有字符”临时设为新需求。
2. **具体动态剩余风险：** 从19项矩阵按触达关系选择 required subset，例如 retained／迟到回调、IME、旋转／重测量、减少动效热切换、TTS 胶囊。每项先写代码侧未决及真实事件要回答什么；方法／SDK能证明的先本地证明，不能一次性把19项全列成默认必跑。

旧矩阵 `executionThisAudit=NOT_RUN` 是建立清单当时的执行状态；后续局部case通过与候选运行证据另建当前逐行映射，不改写原矩阵为全面PASS。每个结论注明源码、构建、像素／事件类型、字号／主题／窗口条件。无法观测就保留未确认，不用 Stage 参考页或旧图替代。

## 10. L11：UNKNOWN 结果不能靠 hash 关闭

此前原书签意图只做 stat/hash，agent 没有取回／解析 payload；正常恢复启动可能由应用自动核对、结算并写库，这是历次范围中明确的应用行为。文件 hash 相等不证明业务已完成，DB 主文件相同也不证明 WAL／全库未变。

先从原业务 owner 审阅“操作身份→结果查询→确认／未决”协议和已有回执。在没有正式业务事实前，保持 UNKNOWN，使用原 RecoveryNotice/RecoveryAction 的未决语义；不能由页面把读取成功、关闭提示或旧文件未变当写入确认。

若确需核对原操作，先形成独立具体方案：读取什么身份、查询什么结果、是否可能触发正常写回、输出哪些脱敏字段、哪些事实能确认／不能确认，按当时有效范围执行。不能以取图或安装授权概括为允许 agent 解析原 payload，也不盲目重放／删除旧意图。业务 owner 的正式确认是唯一退出事实；无法取得则在交付风险中明确保留。

## 11. L12/L13：警告与测试债怎样收敛

### 322 条警告

实际最终构建为313 throws＋7 capability＋2 native。20 missing/member 和32 deprecated已清零，不重新列为未完成。既有313条的源码清单覆盖36文件、9类边界，不是逐点异常注入通过证明：

| throws 既有分类 | 数量 | 后续处理原则 |
| --- | ---: | --- |
| 文件／资源 I/O | 182 | 沿原 owner 检查错误传播、finally、原文件保留和未决写入；只修具体漏接 |
| 偏好与原写入事实 | 51 | 失败不得伪造成功、换操作身份重试或误清恢复状态 |
| 网络／非可信输入 | 12 | 超时／错误／畸形输入回到原边界，不落入无界重试 |
| 音频／媒体 | 19 | 准确资源和任务释放，关联L06，不全局 stop-all |
| 窗口 | 18 | 生命周期和异步失效，原owner清理 |
| 诊断专用 | 20 | 生产和诊断分开；有真实漏接才改，不因存在就运行工具 |
| 确定性 token 输入 | 7 | 保留正常传播，不加任意颜色／默认值吞掉问题 |
| 原生渲染生命周期 | 2 | 源码与SDK合同先定位，设备只答剩余具体问题 |
| 剪贴板／用户输入 | 2 | 平台失败回原反馈／确认边界 |

7 capability已有能力守卫／降级和选中局部情景PASS；不是7项全部尚未验证。后续仅在触达新增风险或具体平台未决时选择对应验证，不追求抑制静态警告。2 native是SDK NAPI verification能力提示，保留声明和实际Native证据，不能标“SDK已验证”。退出目标是触达文件无新增风险、已证真实缺口关闭及剩余项有明确处置，不是322→0。

### fixture／资格

P1 的21份装配适配不等于21份重新审定；仅2个P1叶子已重新审定并经索引PASS，同文件4个sibling及其他19份不能自动续期。P3 有3份 API／factory fixture 更新但未执行／重审；P4 navigation 通过不覆盖同文件4个sibling。各集合可能交叉，不相加成新的“未通过总数”。

后续真正需要某项时，先审该精确 case 的当前生产绑定、import/顶层副作用、SDK lowering、资源、负对照和唯一回执，再决定保留／修复装配／采用已有覆盖。旧 expected SHA 不现场重拍成绿灯；已退役项继续 tombstone。没有作用的旧项可以按明确治理决定退出，不能删测试掩盖行为缺口，也不为了“清遗留”默认跑全部。

依据：[警告处置](/home/administrator/Reader/Reader-for-HarmonyOS/docs/architecture/platform-warning-triage-20261111.json)、[两叶子审阅](/home/administrator/Reader/.local/framework-closure-implementation-20261111/p1-two-selected-index-review.json)。

## 12. L14/L16：可解耦的工程演进与信任边界

### 指纹域

[build.rs](/home/administrator/Reader/Reader-Core/crates/reader-runtime/build.rs:128) 的 storage source hash 覆盖 storage manifest/src（含测试代码），未等价覆盖全部实际依赖；完整 buildIdentity 已另带 Cargo.lock 摘要。当前问题是路由比较域和兼容性语义不充分，不能说完全没有依赖身份。

单列 Core owner 批次定义生产格式／相关依赖／flags 的版本化域，或真实验证的兼容边；排除纯测试噪声，保留旧域明确比较／拒绝策略。需要时重建 Native 并绑定 provenance，不能只在 Host 改字段名。当前没有证明 actual dependency incompatibility，**此项不阻断只用既有字段的观测、诊断修复、TTS、水合修复或历史调查**。若本次真的改变存储依赖／编译选项，另按实际影响制定对应验证，而不是忽略风险。

### 三项工具信任边界

- HDC 字节核验后稍后 pathname spawn 仍可能被可信工具目录的并发写者替换。先固定受信工具路径；可加调度前变化检测，但不要声称重新hash消除所有原子竞态。
- grant ledger 的单次消费在可信持久 host/namespace 内有效。换目录／删状态／跨host不是已证明的全局防重；若成为需求，先固定授权命名空间和持久位置。
- 正常 finally／timeout 可释放 lease，不等于SIGKILL／主机崩溃后所有子进程均清理。需要该能力时用隔离本地进程样本审信号、child identity和stale恢复，不到VM反复重试。

这些均未观察到本次触发，可明确接受现有可信环境边界或独立补工具能力；不统一绑新端口／新Core／新产品功能。

## 13. 可执行批次与依赖

下列是实施计划，除本报告／登记外未执行。每批单一修改owner；实施前把实际入口、嵌套调用、范围、具体风险、必要性写入检查计划。拟议情景不能冒充当前 gate ID 或已PASS。

| 批次／唯一 owner | 解决范围 | 前置与动作 | 退出／停止条件 |
| --- | --- | --- | --- |
| S0 证据 owner | 遗留映射与边界 | 读取现有回执，区分11个未闭finding、交付开放项、L09与已选合法退出 | 本报告及当前索引一致；不重写原FAIL/NOT_RUN |
| S1 交付 owner | L01路径与冻结决定 | 确定先交0511还是纳入Host/控制器修复的新候选；冻结准确输入；准备正式proof工具与失败恢复预算 | 路径明确、产证前提成立；任何工具／身份不明先停，尚不占VM |
| S2 控制器 owner | L02/L03/L05正式共享边界 | 实际方法修消息起点、当前性、统一重验、ABI、post-UID和安全读前条件 | 必要正反例PASS；无法证明来源/安全即拒绝；修改冻结文件则不再冒用0511 transition |
| S3 诊断 owner | L04及L05诊断适配 | 独立client/remote状态、失败子原因、unsafe不执行；不改S2共享读取器 | 假runner/合成文件有限情景PASS，旧回执不回填，无payload落盘 |
| S4a 漫画展示 owner | L09 | 实际hydrator/presentation结果状态、有限重试和筛选语义 | 不改Core进度；24/2/144切片及原例外、身份/token fence保持；同场景同signature失败后的普通visible恢复，真实旧源码反例失败；不自动poll |
| S4b TTS owner | L06 | 先actual-class情景和SDK契约，再决定最小监听退休修复 | 充分SDK依据排除，或风险成立后完成最小修复及真实类旧source反例／回归；准确任务与失败证据保留，不清ID／stop-all |
| S5 产物 owner | 新候选必要输入及资格 | 只纳入已确定生产修复；需用的精确fixture先重审；实际构建直接需要的输入／签名条件核对 | 精确commit/manifest/HAP/Native/controller身份成立；未变部分按依据复用，不默认全量 |
| S6 设备 owner | L01/L10有限交付 | 新具体范围、原VM现场身份/ready、当前目标准确proof；canonical inspect+install（冻结A显式--no-launch）、后置UID/签名/版本通过后才有限启动与生产像素 | 失败即停，额度不续；分段范围预先明确，安装/启动接受/可见/published逐层记账 |
| S7 漫画业务 owner | L07/L08/L11按需独立 | 历史只整理现存证据；恢复／原操作核对各有独立具体范围 | 有candidate才冷读；无历史证据保UNKNOWN；业务写入不藏只读取证 |
| S8a 被动观测Host owner | 可选current-owner authority | 先证明认证／不激活通信可行，再实现既有ready owner的窄观测；复用既有字段和平台能力 | 采用该authority时是S2的前置；端口不可行就只走正式proof路线，不强装启端口 |
| S8b 协议/Core owner | L14指纹域演进 | 独立定义生产输入域、新旧协议和真实兼容边 | 按实际Core输入变化绑定Native；不是其他遗留共同前置 |
| S9 验收 owner | L15 | 明确正式发布／整体验收目标，再选准确合格集合及对应设备层 | 实际通过才PASS；用户确认单独取得 |

**最小关键路径：** S0→S1→（所选候选真正包含的S2/S4修复与S5）→S6。S3、S4a、S4b可在文件owner不冲突时并行；S7的历史调查不等S8，离线恢复不替代L09。若S2采用新current-owner authority，则S8a的通信可行性和Host窄实现是该路径前置；不实现端口就只走正式transition，不能虚填观测。S8b指纹演进始终按真实输入影响独立处理。若先交冻结0511，S2在隔离受控检出推进，安装检出继续保持原controller字节，不能复制两文件到任意目录绕过完整输入绑定。

被动观测的设计退出条件是：已有ready owner可被认证查询、不会激活进程、不调用start/recover、不新建Runtime/原库连接、不读原UNKNOWN，await后校验generation/closing，版本不可用不填常量。若实际传输会走onCreate/onNewWant业务入口而不能证明这些条件，就不采用该传输。

## 14. 最终验收与明确不再追的“假遗留”

完整产品回归、物理机和用户验收目前均未执行。只在有明确发布／整体验收计划时按 GATE_INDEX 建立准确集合；不能把本报告当成批准全部历史套件。代码、方法／SDK、构建签名、准入安装、原生事件／像素、物理机、用户结果分别记账。

以下已形成合法退出，不因为“还有遗留”而重新立项：Stage为REFERENCE_ONLY、16个layout按职责保留、LRE/Panel完成所选seam但仍较大、20missing和32deprecated已清、旧门禁FAIL保留而新定义有独立PASS。这些可在将来触达时继续维护，不是本轮必须重开框架或清零行数的理由。

可接受的结束状态有三种，必须逐项声明：**真实修复并有对应层证据；不满足准入而保留未执行；证据不可恢复而保留UNKNOWN。** “接受暂不执行”是风险／范围决定，不会把FAIL改成PASS，也不会使用户未确认的业务操作自动完成。
