# 正常开书失败：恢复与错误分类修复

## 输入和范围

用户报告《还不起学贷的我只好兼职猎魔》已入架，从书架正常打开立即失败，随后明确“只要在书架打开书籍，就会出现”。提示为“正文暂时无法显示 / 本章暂时无法显示，请重试或调整阅读设置”。本次授权为修复此前代码审计确认的问题。

Harmony HEAD `6b1bd7534b61a8ebfac10150fd308eae8430606e`，包含其他任务 dirty WIP；Core HEAD `9131ddcfeef1922620c6867f88fe82608e51a079`，构建前已出现其他任务对 normalization.rs / remote.rs 的修改。本次未改 Core、书架数据、目录存储模式、搜索身份或换源提交协议。

此前全出口审计与合法正文故障探针见工作区 `evidence/2026-10-23-reading-open-diagnosis/`。这些旧探针保留修复前断言，不代表修复后的验收入口。本次可运行回归是 `tools/test-reading-open-recovery.mjs`，无参只列用例。

## 已实施

1. ReadingContentRead / ReadingEntrySnapshot：入口正文和完整目录读取遇到内容 epoch 变化时，等待既有 runtime 内容操作结束，重新捕获有效性后重读；最多两次重试。目录重启从第 0 页开始，不混合版本。页面退役后不再次请求。明确存储、身份错误不作为可恢复刷新冲突。
2. LocalReadingExperience.loadInitialChapter：补齐快照之后的长段落准备等入口步骤发生内容失效时的有限恢复。错书、存储错误不重试；原书签/位置语义保留。
3. tryInitialEntrySnapshot：仅 Core 明确标记 cacheDerivedCorrupt 时允许常规目录/章节获取。身份、位置及存储失败不降为 cache miss，不清除原文或进度。
4. expandMeasurementParagraphWindow：普通当前页的版本失效等待后通过 openChapter 重读，传递原 body/processing 版本及 requested 锚点，由既有迁移核对位置。旧窗口不能与新正文拼接。邻页和控制跳转仍由原恢复 owner 处理；自动恢复最多两次。
5. pendingPageBodyCapacity：无章节标题时不要求正数标题高度；有标题且位于首页时仍必须取得真实标题度量。
6. 原生同步测量临时返回零行：beginMeasurement / consumeMeasuredBatch 在当前测量身份内最多延后一轮重测两次；退出、切章、测量代次变化后定时器不得重启阅读。非法宽度等其他异常不自动重试。该修复不代表已证实用户现场返回了零行。
7. 快照、目录窗口、正文窗口和本地目录/正文/进度读取复用既有命令错误适配，保留 Core storage/position 错误及 cause。内部位置、空正文、空目录、获取期限和能力缺失不再全部显示“调整阅读设置”。消息仍使用已登记 ReaderPageState，更新原入口类别说明。
8. fail 新增公开的有限内部诊断字段 phase/kind/guard/command/category；原始错误继续私有记录。新日志不包含书名、sourceId/bookId、URL、正文或凭据。

本次复用 Reader 已有失效计数、等待队列、位置迁移、缓存重建和错误适配；新增 helper 仅协调 Reader 读事务，不引入通用缓存/匹配/排版引擎。

## 验证计划与结果

所有检查默认 OFF。本轮未执行全量门禁、Core 测试、设备操作或网络书源试读。

| 精确入口 | 必要性、实际及嵌套范围 | 结果 |
| --- | --- | --- |
| `node tools/test-reading-open-recovery.mjs --case content-read,reader-entry,window-recovery,title-layout,failure-kinds` | 五组实际生产方法；真实 preparation fence、快照/目录解码、受控 Core I/O 和定时回调，AST 选择及转译，不附带其他套件。保护正常刷新后可读、退出不重启、有限重试、存储不吞错、错书/位置拒绝、无标题可分页及原生重试边界 | PASS |
| `H-reading-entry-snapshot#atomic-body` | 既有快照正常正文读取；精确 case，未嵌套其他检查 | PASS |
| `H-reading-entry-snapshot#resume-chapter` | 仍拒绝正文章与恢复进度章不一致；含移除保护的负对照，精确 case | PASS |
| `H-reading-entry-snapshot#cancellation` | 原内容 fence 失效仍不得接纳旧快照，精确 case | PASS |
| `git diff --check` | 当前修改无 diff 空白错误，不代表编译 | PASS |
| `node scripts/hap-pipeline.mjs build --class iteration` | 仅规范隔离开发构建，contracts none；直接条件为完整 ArkTS 编译、Native/SDK 输入配套、指定签名及包字节校验 | 首次尝试 FAIL：共享构建锁有活跃 owner，未进入编译；未强解锁 |

首次构建失败回执：`.reader-artifacts/hap-attempts/1792772374696-13473207-54e9-43c0-a9ec-6df24ad70442/stages.json`。源码与受控生产方法测试、真实 ArkUI、HAP、安装和用户验收分层记录。

共享锁释放后再试，第二次在编译前停止：`HAP retention budget 10 cannot fit 10 protected runs plus 1 new run`。回执为 `.reader-artifacts/hap-attempts/1792772535411-5b10b337-4385-437a-a359-edad59f2f20a/stages.json`。没有删包、解除恢复保护、提高上限或通过另建产物目录绕过限制；本轮 HAP / 完整 ArkTS 编译仍未完成。

最后仅扩充 failure-kinds 用例，通过实际 LocalReadingFlowGateway 的目录、正文、正文指标、进度及真实 document-window 请求验证 storage 分类和原 cause 保留；并补齐未知 progress.get 失败的 CONTENT_LOAD_FAILED 分类。仅重跑该 case。

## 后续构建结果（2026-10-24）

用户授权优化 HAP 保留策略后，已生成签名开发包 `20261023T163829Z-6b1bd753-64fb4e59`，完整 ArkTS 编译、签名及包校验 PASS。Signed HAP SHA256 `a67f3ae4bdeac01a83f1258bf532903ecdf3ff8c87586feec78cf5b9e34ee025`；manifest 位于 `.reader-artifacts/hap/20261023T163829Z-6b1bd753-64fb4e59/manifest.json`。本包包含当前共享工作树 WIP，contracts none；此前编译/保留阻断已解除。保留策略、过程失败及精确回执见 [HAP 保留生命周期](hap-retention-lifecycle.md)。未安装设备，不能据此称用户开书故障已现场验收。

### 尚未闭合的行为证据

PC 端 HDC 复核（2026-10-24）：已通过跨对话命令记录确认“分析书签图标层级样式”与本任务均对同一手机连接和同一 8710 服务执行恢复操作。共享租约事件记录 00:30:53 remove、00:32:07 tconn、00:33:22 start -r、00:33:42 tconn；本任务随后也执行一次 start -r 和多次有界连接尝试。本任务直接调用 HDC 的恢复命令未经过已有 reader-hdc-lease，是操作流程缺口。当前 wrapper 已按 serverKey 而非 target 加锁，且会归一化 IPv4-mapped 地址；不能把本次归因为已证实的锁键分裂。检查时仅一个 server 进程，租约空闲；多任务交叉恢复已证实，持续抢锁及其是否为连接失败唯一原因未证实。手机连接曾为 Unknown/Offline，日志 handshakeOK=0 不能证明手机授权异常。停止重复重启/重连；安装仍未执行，数据未变。

后续用户授权安装到手机并重启 HDC。已重启本机 HDC；手机网络调试端口 TCP 可达，但重新连接后 HDC 仍显示 Unknown，未进入包/设备预检或安装，没有改变应用数据。原成功包已由后续构建滚动淘汰；现存 `20261023T163955Z-6b1bd753-2514070c` 与其源码快照仅 `ReaderMessagePreviewPage.ets` 不同，开书修复相关输入一致。尚未完成该替代包验签和设备兼容预检，不能计为已交付。等待手机调试会话恢复后继续。

- 尚未绑定用户已安装 HAP，未取得现场本次 reader-failure 原始阶段/错误；不能称每次书架打开失败的设备根因已唯一闭合。
- 原生测量验证为受控返回和生命周期测试，不是 ArkUI 像素或设备行为验证。
- 换源正文预取时机、统一数据模型等架构建议不等于已确认缺陷；本次不重写跨源持久事务，也不提前提交或放宽规范位置确认。
- 构建、安装和现场打开验证必须分别有新证据，不能由上述局部测试推定。
