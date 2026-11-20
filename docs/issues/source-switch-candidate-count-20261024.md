# 阅读页换源重新查找：七候选减少至三候选

## 场景与边界

用户明确第9项发生在阅读页换源窗口“重新查找”，不是普通搜索结果卡片。此前普通搜索“已发现”计数的两处真实显示问题仍保留，但不能作为本问题已经解决的证据。当前Host main `6b1bd753` 有大量dirty WIP，尤其 SourceSwitchHost 的openJourney/弹窗生命周期修复必须保留。Core不修改，无HDC、构建、真实用户库写入。

## 源码审计

- SourceSwitchGateway.discoverCandidates 实际8并发遍历 enabled 的小说来源；没有3/7候选数量上限，不按provider family折叠不同sourceId+bookUrl。普通搜索L1/L2 health skip/60秒cooldown不用于该入口。
- 更正前一普通搜索审计的推断：换源仅复用SearchGateway公开decoder，不调用searchBySource。单源实际runtime.request('book.search')没有显式15秒期限，ReaderRuntimeOwner默认30秒；不能把普通搜索15秒限制归因给换源。
- “重新查找”进入Host.discover(force=true)，传excludedSourceIds=[]，完整重查，先前普通搜索searchedSourceIds不会限制本次。点选源直接进入的准入/事务体验保持。
- 匹配要求书名规范化相同且作者身份相同；普通“作者：”标签可去掉，@修饰必须当前规则证明。实际目录/正文错误不会被改成所有同名书都可选。旧源码新增此保护曾阻止《大明望族》误切成《跳出轮回》，不能为了凑七个去掉身份核验。
- 当前内置源与具体旧源码基线的启用差异已在search-source-count-20261024.md记录；用户未给旧run和七个来源名单，不伪造旧设备基线。

## 第二条真实丢源路径

Gateway.refreshCandidates 本次查到的live seed可以暂时领先持久化。在最终loadCachedCandidates中，显式missing且从未确认持久化的同书/启用seed可保留；已经确认持久化又真实删除的候选必须清理。

Host.discover 的coordinator订阅在完成后仍会触发refreshProjection，但只将context.readKnownCandidates/knownCandidates作为投影seed。书架进入阅读的Index.knownSearchSourceCandidates返回[]，因此本次强刷新查到的live seed没有传给下一次投影。三条durable+四条暂未persist的七候选，可在任意后续acquisition delta时变回三条。该路径与普通搜索卡片计数无关。

拟修复仅在当前discover闭包将本journey已接纳的可见候选合并给Gateway重核验，不建立永久候选缓存、不改openJourney或事务。真实删除、停用、错书、旧scope回调仍由既有Gateway与Host guard排除。

## 必要定向验证（默认OFF）

唯一新增准确case `host-live-retention`，入口 `node tools/test-source-switch-gateway.mjs --case host-live-retention`。执行真实Host+Gateway+decoder、受控Core协议端口和虚拟时钟，无SDK/网络/构建/设备或兄弟case嵌套。先取得修复前实际7→3的红测，再验证修复后delta保留七候选；将一条live成功持久化后真实删除必须退出，来源停用/换版本不得由旧visible seed复活；旧journey退役不能污染同名不同绑定的新journey。必要性直接对应本次新修改的seed来源与scope保护。

## 已做公开源抽样（只读，非穷尽）

除本轮此前松鹤精确搜索/详情/343章目录/首章成功外，追加5个仓库已知搜索端点，最多2并发、每请求15秒，仅传公开书名，无账号/Cookie/用户库：QQ手机版HTTP200，data.books20项，未匹配精确书名；企鹅读书与企鹅阅读各HTTP404；百度小说HTTP200/errno0/novelList0；起点手机版HTTP200，页面包含精确书名和“小夕岁”。这是PC响应摘要，不是Core规则解析/手机请求，也不是134个已启用URL全扫描，不能据此承诺七个可用源。

## 修复、真实红测与结果

- 修复前，新准确case真实执行Host.open→当前缓存关系（三个可选源）→Host.refresh→Gateway.refreshCandidates（七个可选源）→coordinator delta→Host.refreshProjection，最后实际断言失败 `3 !== 7`。没有用直接调用替代该Host时序。
- 仅改 SourceSwitchHost.discover 内 knownCandidates 闭包：合并当前scope的可见、同书已准入候选和外部Search种子，再交Gateway重新验证。没有新增跨journey字段/永久候选缓存，没有修改openJourney、点选/事务、关闭弹窗生命周期或Core。
- 修后 `host-live-retention` PASS。随后只在同一case补齐plain作者、从当前规则/精确book.get恢复@作者证明两组，再次PASS。两组都从书架known=[]出发；当前绑定只保留为context，七个可选源不受其影响；同query强刷新后元数据delta不再回退三条。
- 仍证明：一个live seed真正持久化后再被删除，必须从7降6，不能被旧可见snapshot补回；停用来源继续退出；来源换规则重新启用不从隐藏旧seed复活；新journey同书名但不同source/book绑定只接纳自己的durable关系，旧订阅回调不能覆写或拉取新scope；作者证明回填后的cache/discovery匹配使用同一query。
- 请求范围限source.list、search-book.related/batch/get与本次显式book.search及既有timing增补；受控timing写失败不吞合法live结果；没有提前发book.detail/book.toc/chapter.content、提交换源或删除用户记录。
- 源码没有找到总数3的硬上限，也没有定位到手机四个候选的实际persist状态。因此本次修复闭合一个与换源窗口一致的真实7→3序列，仍不能宣称手机该次唯一根因或七个源均可正常阅读。
- 没有跑其他case、全量、HDC、Native或HAP；没有Core变更。父任务统一登记和后续构建。

## 后续实际 PC 全源搜索

用户随后明确要求实际项目规则逐源验证。已完成当前全部 101 个启用小说源的真实 Core 搜索；精确书名与作者匹配 4 个 sourceId，按站点 hostname 为 3 个。生产换源窗口确实过滤当前完整绑定的 isCurrent 项，因此当前松鹤对应本次搜索身份时为 3 个可选替代源。详见 [PC 搜索明细](pc-source-search-count-20261024.md)。该真实网络结果与本节前述受控七→三回归分别记账，不能将受控fixture当成手机当时确实搜索到七个的证明。
