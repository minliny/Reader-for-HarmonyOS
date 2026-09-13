# TOC、简介、Native/进度恢复实施记录（未提交工作树）

## 已实现

1. Core book.toc 首/续页及章节正文上下文同时携带 canonical bookUrl、book对象、当前页 baseUrl；重建可信 source/book/chapter 字段，规则变量 java.put 跨续页保留。重复或新源绝不沿用不同身份/版本变量。
2. Harmony acquisition 不再以旧、缺失、过期 acquisition 排除合法持久目录。缓存优先校验同源同书；旧规则上下文只允许已下载正文，缺正文时用当前规则共享一次刷新。删源仍可读已缓存正文，缺正文给明确失败。源变更即时失效版本，旧异步结果不能覆盖新会话。
3. Storage/身份/取消/版本变更不按 cache miss 吞掉；仅缺失/衍生缓存损坏可恢复网络。异常记录限制数量，保留同次 cache 与 network 因果，真实 SDK error.event requestId 被消费；不输出 URL、cookie、header、变量或原文。
4. Core 所有 TOC 首/末响应诊断增加 decoded UTF-8 responseBytes 和 SHA256 responseDigest，含成功零章；optional 首响应与 final URL digest，schema/fixture/DTO测试同步。HTTP失败、JSON格式错误、规则错误、循环/超限分别返回分类，部分目录/空目录不能覆盖旧持久缓存和进度。
5. 空首页仍执行有限下一页；卷标题原 canonical index 保留，UI navigable=false，目录跳转/下载/书签保护。LRE 单独缓存可导航投影供初始进入、前后章、TTS、预加载、seek使用，原目录和持久章节编号不变。
6. 标准简介清理复用已锁定 scraper/html5ever，限定显示边界；已有 search/book.info/书架输出 intro 被清理，源记录/原始存储不改。不加新DTO或手写实体解析器。覆盖命名/数值实体、有限重复转义、实测全角分号 &lrm；、纯文本尖括号、HTML段落、emoji ZWJ、RTL方向标记。
7. N08：从常驻 ArkUI slot 独立上报 exact revision content-ready 与后续 scheduled-frame；正常释放必须二者均匹配。删除“等两帧即释放”的绕过。slot/clear通知丢失时，已准入目标转稳定二维所有权，不无限重试Native；目标未准入时保留不透明终帧并提供重新显示入口。旧generation不能clear新表面。
8. Native原有surfaceEpoch/NAPI过滤和ClearSurface不swap透明帧已审计保留，未重复重写。桥注释改为准确的调度/内容确认语义，不把它称display fence。
9. 持久化：有界UI观察不释放实际串行写队列；never-return进入unknown，原写迟到仍只promote一次。失败/超时只串行读取权威锚，原锚须更新时间与locationRevision一致；未知/外国写入不猜测回滚。连续滚动保留唯一真实drain，观察超时不能谎报退出保存成功；重试先查询未知锚，不重复写，最新尾部位置在原写返回后继续提交。

## 回归

- Core source_fetch_and_catalog_tests 27通过，目录筛选集合包含33个分页集成用例；reader-content TOC 49单元+4集成通过。简介标准实体组通过。
- 合同DTO 184通过，schema总266样例unexpected_invalid/valid均0。
- runtime完整集成624通过，3个本机WebDAV mock最初被沙盒监听拒绝；已按授权仅本机回环重跑3/3通过，无真实服务器访问。
- 本目录20个 test-*-final.log 均通过，包含正式N08失败探针转绿、unknown/迟到/foreign/单drain、native恢复、卷标题导航及TOC/缓存/目录保护。Native C++真实Host+GL mock 245检查0失败。
- 根负责统一ArkTS编译。已修本轮诊断中本组ReadingCommit遗漏updatedAt类型错误；无设备/VM操作、无自行提交。

## 证据边界和集成

Index由页面agent接入coordinator、navigable、首个可读probe、recentFailures消费者；已收到完成确认。LRE范围仅本组目录导航与Native/持久化方法，胶囊/主题由各owner保持。

source-snapshot.json 是报告时工作树快照（共享文件仍含其他agent变更，后续统一格式化/集成会改变hash），不是最终交付manifest。Core remote.rs WebDAV片段、合同WebDAV字段、schema WebDAV字段归页面agent，本组只拥有TOC/intro/diagnostics；Cargo.lock共享变更由root统一审查。

没有把历史真实站点所有 book.toc 报错都声明已复现：已确诊缺bookUrl与缓存准入，并用确定性故障样例验证其他修复。实际书源/运行时WebView/网络变体仍需要绑定候选的最小验证。没有物理display fence，也不把postFrame/GL swap等同屏幕上屏；逐帧闪烁、触控到屏幕、GPU/温升/长期资源仍属于原规格独立门禁，不能用本地回归关闭。真正永不返回的Core写不能被安全强行中止：实现保持unknown与可读页/查询入口，不伪造成功或强行重写；重启后从Core持久进度恢复。


## 末轮新增闭环

已在既有evidence目录写入 implementation-prior-gap-matrix.md，52个唯一ID+Make七组逐项映射。补查后发现B5实际Make有循环波形（PhoneScreen.tsx327/1354），已实施ReaderTtsWaveformModel.ts + ReaderTtsWaveform.ets并由capsule owner接入TtsContent/Panel；真实轨道/单clock/frozen-source/不可见停止/旧owner无效正式测试通过。不能保留“Make波形静态”旧结论。

ReadingOfflineGateway.ts新增标题navigable/unknown、跳image manifest、可读进度总数、纯标题range跳过、无效标题materialization lease拒绝；对应现有离线回归增加4组通过。test-reader-control-p0旧目录a11y断言更新并通过。以上新文件由root统一编译与提交，本组不提交。

## 全量 Core 门禁收尾

完整 nextest 跑过全部 3718 项：初轮 3713 PASS；2 个旧断言（regex helper必须保留RuleSpec，inline TOC已有响应摘要）定点修正后2/2 PASS；3 个默认沙盒禁止监听的本机WebDAV mock经限定回环权限重跑3/3 PASS。保留原始失败日志，不声称一次全绿。3份固定host replay语料共11步只增加37个精确摘要字段，commands/hostResult/原expected字段不变；SHA256独立由Python从固定body与finalURL计算。CLI conformance210/210、strict contract drift（185 methods、0 blockers）、C/C++ FFI smoke与fmt均通过。最终门禁没有修改已冻结的生产路径。证据与完整派生数据见core-final-gate-summary.json及同目录日志。

Waveform最后增加显式active订阅控制，Panel以visibility/launch ownership/obscured共同驱动；隐藏的永久挂载Control Runtime不续帧，真实playing不被篡改。正式测试覆盖最后subscriber退出后pending callback不续链和真实Panel/TtsContent绑定。Native迟到VISUAL_COMMIT_ENDPOINT/ROLLBACK_COMPLETE/TERMINAL_RELEASED都受active、generation/surface guard，二维fallback的完成幂等。
