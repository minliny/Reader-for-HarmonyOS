# c56 搜索当前剩余性能与作者分组审计

日期：2026-09-15。审计源码 Core c28f0f792，Harmony c56ad545；父任务后续 Host HTTP 独立提交 6f486cfa 不改变本报告的搜索代码。本子任务只读源码、读已留存 VM 证据、在 /private/tmp 执行本地受控探针；没有设备操作，没有修改仓库。

## 触发与证据边界

父任务给出的 c56 VM 同次《鸣龙》搜索：4.682 秒完成19/109源、117组、3失败且已有正确关关公子；8.679秒28/109、350组；15.693秒40/109、363组；30.685秒66/109、520组、8失败、11候选。后续最终682组、16失败，正确组15候选。进入正确组详情2.674秒（松鹤）、首章2.718秒可读；阅读→详情→16换源候选→原搜索返回成功。这是父任务保留的 VM 行为，不是本子任务重新操作所得，也不是所有源/全文验收。

日志 `/private/tmp/reader-proxy-vm-c56-search/reader-network.log` 只有失败原因和时间点，未包含成功响应字节数、桥接分段耗时、帧时间，因此不能从它证明本次存在8MiB响应，或将某同步路径直接宣称为这次秒级卡顿根因。终态分组证据 `/private/tmp/reader-observed-return-c56.log` 与 `/private/tmp/reader-proxy-vm-c56-return/reader-control-query-search-return-1.json`。

## 当前已排除的旧问题

- Core runtime.rs:462–478、:935–1013：3条搜索worker与1条阅读worker的独立共享队列；不是以前按worker轮转投递到独立私有队列；JS规则不在ArkUI主线程运行。
- BookRequestScheduler.ts:39–59 为连续取源，单源完成即可释放槽；:162–175 总6槽，非前台最多5槽，准备最多2；不是按一批最慢源等整批。SearchOrchestrator.ets:27 实际搜索并发4；不能把4本身叫死锁或再次提出旧批屏障修复。
- SearchOrchestrator.ets:94–104 缓存flatten，:597–622 首结果立即、其余100ms合批；:852–923保留不可变对象与明确delta。SearchPublication.ts/ SearchPage.ets:268–276 当前为稳定holder+标量revision，而非嵌套DTO @Prop递归复制。
- SearchResultProjection.ts:54–155 只重新算受影响组，进度计数不重排；SearchPage.ets:833–868沿delta构造变化组，:149–249数据源单遍构造，不重复splice/indexOf移位。每次非空新源仍有O(总行数)索引比较与全排序键更新，下面量测其当前量级，不凭大O虚报现时缺陷。
- SearchGateway.ts:266–287 当前按源revision共享source.list；不会每个候选元数据事件重新加载所有书源规则。
- HttpExecuteHost.ts:852–860 文本响应已不再同时构造Base64，只有二进制保留；不能把曾经文本双份Base64成本再列现存缺陷。

## 受控生产方法结果：当前结果更新不是已证实瓶颈

`result-publication.mjs` 加载当前真实 SearchQueryRun.admit/results、SearchOrchestrator.publishRun/present、SearchResultProjection.update、SearchPage.groupResults、SearchResultDataSource.replace。只对native UI通知设空边界，未替换这些算法；未包含ArkUI布局/绘制成本，不是Harmony耗时。

|已有组数|首次全量发布（3次范围）|进度状态无变更|新增32组发布（3次范围）|
|---|---|---|---|
|682|1.65–3.70ms|0.006–0.014ms|0.62–1.19ms|
|1000|1.99–2.67ms|0.002–0.020ms|0.78–1.03ms|
|5000|10.67–16.12ms|0.003–0.010ms|5.11–7.01ms|
|10000|22.04–30.44ms|0.004–0.019ms|7.25–10.10ms|

结论：在本次682组量级，未发现可以解释几秒一次刷新的数据计算缺陷。5000/10000为额外可重复受控规模，不是本次VM真实结果量。先前测试已约束对象身份和原生通知语义；本次没有证据支持为了这682组再做列表架构重写。新增源全索引扫描可继续作为扩大规模后的优化项，但不应列为本次必须再次修复的已定位根因。

注：首轮临时探针将顶层return交给Node类型擦除导致测试脚本语法错误；修正临时探针为class声明后执行，同一生产源码未修改。最终原始结果 `result-publication.json`、脚本与日志均在此目录。

## 真实存在的同步大响应风险，尚非本次卡顿归因

1. HttpExecuteHost.ts:828–860 /:1382–1415 的 buildResponse/decodeTextStrictly 在Host/ArkUI调用线程对整个bytes做严格解码；多charset失败可再走后备解码。:29允许响应64MiB。
2. reader_napi.cpp:144–160/793–841 完成Host请求时同步JSON.stringify、读取UTF8字符串并构造命令；:265–273立即调用rc_runtime_send。
3. reader-ffi/src/runtime.rs:95–128在调用线程 serde_json::from_slice 分配整条Command。reader-runtime/src/host_callback_bridge.rs:720–745匹配JS回调时还克隆result再唤醒worker。
4. SDK reader_core.ts:765整条JSON.parse；:388–394每32轮让出线程只解决事件链，不能中断单个大JSON处理。SearchGateway.ts:216–222每32书让出也在SDK整条parse之后。
5. 请求正文编码 HttpExecuteHost.ts:900–933→encodeSharedText→reader_napi.cpp:569–628仍同步，但典型搜索只有很小的关键词/form。本次没有巨大请求体证据，不应将新增成熟encoding_rs编码修复误报为普通搜索的秒级瓶颈。

`native-main-thread.mjs` 使用现有 `/private/tmp/reader-native-encode-probe.node`，先真实调用core.info核对Corec28/gitDirty=false，profile=debug，再通过真实runtime.hostSmoke→host.request→completeHostRequest→真实SDK parseReaderCoreEvent量测。没有stub runtime；父任务也确认该.node链接实际Core。Node26/macOS调试profile，非Harmony release，且不含HTTP解码，不能直接套到设备帧时长。

|正文UTF8字节数|host.complete同步段（3次范围）|SDK整条parse（3次范围）|
|---|---|---|
|16KiB|0.14–0.47ms|0.01–0.07ms|
|128KiB|0.99–1.02ms|0.06ms|
|1MiB|7.54–7.87ms|0.47–0.53ms|
|8MiB|62.46–64.90ms|3.77–4.31ms|
|32MiB|260.00–283.61ms|15.36–24.24ms|
|约64MiB|510.26–532.29ms|29.02–33.15ms|

这些是受控大小，**没有把16/128KiB叫作当前VM实测响应**。同一同步调用期间timer均不能执行。小响应本地结果不足以解释历史几秒卡顿，大单响应确能形成长任务，但当前日志无法证明本次命中。

最小下一步应先补有采样上限的成功路径分段记录（响应字节数/解码/Host提交/SDK解析毫秒、请求方法和匿名请求ID；不写正文、cookie、完整URL），复用实际交付测试中的日志。只有出现长任务后才针对该段用既有NAPI async-work/平台并发能力卸载；不能直接改Core同步ABI错误返回语义，不能靠丢结果、裁正文或全局降低合法64MiB限额消除指标。JS回调必须保留不入正在阻塞的同一worker队列的快速完成通道、取消/运行时租约/错误合同。当前只提出此限定诊断和修复路径，未授权自己改仓库，也未宣布该风险已修。

## 搜索总等待与并发的结论

搜索最多4源并发、每请求默认30秒（ReaderRuntimeOwner.ts:52、:178–195，SearchGateway.ts:354不另覆写），Host一次总deadline25秒。若四源都慢，后面的未开始源会等某个槽释放，这是有界并发的真实行为。当前已有连续worker与前台保留，不能通过简单无限增并发解决；高并发也会增加Host同步回包突发。

本次4.682秒已有正确组、30.685秒已有66源，而不是旧反馈“两分钟目标书仍不出现”。日志缺每源开始/完成成功记录，所以本轮无法将剩余尾耗时分成网络、规则CPU、Host回调或排队占比。不要仅凭109源最后结束时间给出“将并发4→某数即可达标”的保证；现有3搜索nativeworker亦须纳入CPU/内存约束。

## 新发现的确定功能缺陷：规则附加@进入作者身份

终态布局有同名《鸣龙》“关关公子”与“@关关公子”两个组；“给大帝收尸”和“@给大帝收尸”同样分组，@组来自爱推书君（优）。

已读取原始兼容语料：Core tests/fixtures/corpus/sources/src-337-bdeaa8132c97.json（源URL末尾/）、src-338-c9e9adfbdfab.json（无/），和同源旧版src-1065-0a6f4d44c21e.json。三者 ruleSearch.author 与 ruleBookInfo.author 都是完整 `@{{$.author_nickname}}`，说明@为规则显式拼接字面量，不能直接推断任何裸@名字都是装饰。文件SHA与相关字段 `author-template-evidence.json`。当前VM源原JSON未在已留存证据中找到；行为与语料吻合，仍明确不是读取过VM source version。

### 最小实施范围供根任务评估

- Core复用现有Source语义解析得到该字段规则，只承认完整已证实的模板签名（搜索/详情各自实际规则），不新增通用模板parser、不改每个内置源、不按站名硬编码。不匹配的复杂JS/组合规则保留原值。
- 派生作者只去模板额外输出的一层@：raw=`@关关公子`派生`关关公子`，raw=`@@笔名`派生`@笔名`；纯`@`、空作者不形成非空身份。原Book/SearchBook.author、源JSON与JS变量不改。
- 使用现有 sourceVersion 约束的 acquisition facts 保存该**原作者+规则签名+源版本**的派生证据。已有SQLite别名/闭包能力消费证据，为那一条原alias产出唯一规范作者；不能把裸名当第二alias而继续允许装饰@去匹配其他源的真实@笔名。历史别名只有有对应证据才做同样转换。
- Host初始组/相关性、Core投影、候选同书信任、详情身份、换源身份都复用同一个已验证派生作者，raw仍作为脚本输入和存档。优先透传现有acquisition facts，必要时新增Host内可选派生label，不另做全局strip@ helper。
- 旧数据只补可验证的派生关系：当前源版本与缓存证据吻合且模板确切时补；版本不明或规则已变不猜。事务和现有索引版本机制处理撤销与重建；保留原记录/进度/书签/正文。不得以重新网络搜索或清缓存掩盖迁移。
- 负例：其他源真实`@笔名`不能和普通笔名合并；本源原始nickname含@时只移除模板新增一层；不同author、空author、模板变化/版本变化、非同模板JS、同名不同书。正例同时覆盖当前两个作者和URL有无/两个源，且从真实规则求值到storage关系→Host候选→详情比较贯通。

该具体修复可能涉及reader-domain薄字段规则签名识别、runtime acquisition、storage派生索引、Harmony作者helper与seed/identity连接；没有必要新增协议enum或改网络API，但Core生产改变需要重编Native。当前只交方案，等待根任务协调冻结窗口，不擅自修改。

## 本轮结论

确定未闭环功能是有规则证据的@作者归并。性能侧已证明大单响应同步风险，尚没有证据把它归因为本次682组搜索的秒级卡顿；典型结果增量方法没有量测出对应长任务。维持已修的线程/连续取源/前台保留/增量发布方案，不应为了泛化优化阻塞当前具体归并修复及可运行包交付。
