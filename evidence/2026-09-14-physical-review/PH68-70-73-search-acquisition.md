# 鸣龙搜索、目录失败与换源复用专项审计

用户在真机搜索《鸣龙》报告大量卡顿；作者关关公子组默认“66书吧-起点”，详情章节解析失败；更换书源重新搜索，第二源成功。设备仍84cdc4ef，PH56–67搜索修改未安装。没有当次搜索payload/sourceId/TOC响应，不猜具体规则身份。
初始只读审计基准Harmony29d1bb4afb486ead5c8fc95129940dd42fc8a5b0；Corebf3e2682051f0c5d84103800c1cec4e7140b203c；UIe0ef372f7a9f9517382abeeec8270eeaaf389bc0；Legado6763d061bc92b2164ac274363a807e4ed4be34e2，四仓读取时clean。父任务随后整合版本另记。
初始审计阶段只读源码并运行本地生产方法探针，不改生产或仓库测试；随后按 root 授权实施，见下方实施与回归记录。所有阶段均未由本 agent 操作设备或构建。Legado只作GPL语义参照不复制实现。范围SEARCH/DETAIL/SWITCH，代码/本地/设备/视觉/用户验收分别记录。

## 初始审计已定位（基准生产链，不等于当次手机全部根因）

1. Index:2309–2336 每次presentation发布全量filter/map及variables复制，然后Coordinator:135–141再次逐条查key。计数/最终状态也调用，虽重复工作不会重复排队，CPU/分配仍重复。2,000行相同数组10次探针复制20,000次、pending1998/active2；桌面6.5ms仅该局部同步方法，不作手机阈值。
2. Coordinator:339–390只有并发2，没有总量/可见性预算。实际12候选全部detail+TOC+正文+progress+verdict，共84项书籍RPC（另1次source.list）。预热不是目录预解析，而是全量候选最终正文探测；scope只在新搜索/stop/回书架清pending，打开detail不清/暂停。SearchOrchestrator的可见性只约束book.search，不能约束这条预热链。
3. 每次book.search/detail/toc/put/change均触发Coordinator:112–113/417–424统一16ms通知。SearchOrchestrator:244–290对每次通知重新refreshBooks；SearchGateway:276–375每次`search-book.list {}`读全持久库并重建索引，不限当前组/当前查询，虽然每32项yield，传输和事件JSON.parse仍全量，累计排序/映射未消除。一个可见书/2,000持久行连续3次实际方法读6,000行，桌面718.8ms包括yield，不是连续阻塞值。SDK reader_core.ts:519/664–665同步事件parse；不能据此声称已量到手机帧率。
4. SearchPage:845–907新数组仍遍历全部结果、新建group/variants/maps并排序；已修的facts缓存及DataSource局部通知值得保留，不能回退。分组代表只看相关度、更高分替换；同书同作者score相同不会因为已知失败/可读性换代表。生产方法探针first.failed/second.readable仍选s1。源码按source bucket顺序拼接，不可简化成纯网络到达先后。
5. Index:2341–2379把全部variants传入openRemoteBookDetail；:2556–2567构造candidateSeeds但实际只acquire主seed。:2715–2739失败后parseFailed/showFailure，无备用尝试。:2744的openSearchSessionCacheFirst无任何生产调用，仅被旧regex测试锚定，是验证缺口。真实Index→Coordinator→Gateway探针首源空TOC、次源健康，只有s1的detail/toc，最终parseFailed。
6. Coordinator:196–211把24h内prepared命中一律当作要forceRefresh，刚warmup成功点击又get/detail/toc。探针已证；应以同version实际catalogAt/freshness决定刷新，不以“来自prepared”判断过期。
7. Index:4145–4190普通换源只loadCachedCandidates，显式刷新才refreshCandidates。SourceSwitchGateway:195–240全source.list+全search-book.list建索引，已有候选2行探针0网络搜索；空时直接empty，不拿当前传来的variants补首屏。84cdc4ef旧包同样已有cache-first条件，不能把用户“像重搜”归因为一定有book.search；可能全量读库/重投影或前次后台预热，准确请求序列仍无证据。refreshCandidates:247–258显式刷新每次扫全部启用源、后再全量TOC/正文预热；没有“仅补缺来源”计划。
8. SourceSwitchGateway:797–839每投影再读整源列表，未复用revision；:929–937仅sourceOrder排序，带失败标签不影响顺序。更换预览source (:4336–4353)会复用Coordinator session，并仅当前目标正文探测至多3章，这段是已具备能力，应保留。
9. root独立确认SearchOrchestrator.open并行source/history、首屏无await屏障；但立即search再次loadSources，Gateway:230无cache/inflight入口共享，重复source.list及解码。root负责独立修这项。

## Legado实际行为（仅语义参照；GPL源码不复制）

- SearchModel.kt:83–147 专用线程池上限并发搜索、单源30秒，返回后持久SearchBook并合并/发送；普通搜索没有逐结果bookInfo/TOC/正文预解析。:153–232按完整书名+作者合并，精确/标签/包含组后按来源数排序。其算法本身也有全数组/嵌套扫描，不能照搬成性能优化。
- SearchViewModel.kt:59–60 postValue；SearchAdapter.kt:23–49 DiffUtil身份与局部payload，:74–77点击把准确bookUrl带到详情。
- BookInfoViewModel.kt:115–175优先书架/准确bookUrl本地SearchBook，后备才按name+author/sourceOrder找一条；先展示书籍，已有TOC本地直接用；缺tocUrl才详情，缺章节才TOC。:275–279/:335–339解析失败展示保留信息和错误，没有普通详情失败自动轮询所有源。
- ChangeBookSourceViewModel.kt:195–229/603–625首先按名称作者/启用源/组取持久候选，非空直接显示；空才startSearch；可选字数测量会刷新旧结果。:360–447仅根据loadInfo/loadToc/loadWordCount设置进行额外预解析；TOC内存预算30,000章节；字数测试读当前章（阅读入口）或末章（详情入口）。设置来自AppConfig:565–585，不把可选能力说成默认所有搜索预解析。
- 换源排序:151–185先书籍评分/源评分，之后配置的响应时间/字数和源顺序；不会天然知道从未探测候选是否可读。:659–731选择换源时优先tocMap/bookMap已有结果，缺才补必要详情/TOC。
- :784–811确有autoChangeSource依次试同类型候选，但调用点ChangeBookSourceDialog:482属于移除当前候选后的换源操作，不是搜索点详情的自动失败恢复。不能借同名方法声称Legado已有完全相同闭环。

## 当次“66书吧-起点”的证据边界

bundled reader-tested-book-source-collection.json 中零基索引57/126/1027是同站名变体，1027名称准确匹配用户显示名；ruleSearch通过起点搜索结果与 jsLib 的 ho 生成起点 book 路径，TOC的JS再请求wxapp.qidian.com categoryV2，遍历data.vs/cs并输出包含data URL的章节。搜索成功不证明该独立TOC端点响应/JS执行成功。Core已有qtqd字符串DSL、JS数组/裸字段title/url等适配与回归，不能只看特殊格式就下结论不支持。没有该次sourceId/version/bookUrl/响应，仍不能断言用户当时恰是bundled1027或根因是站点/API变化；需先用离线mock响应覆盖这类真实规则结构，失败才定点Core修复，若通过再界定最小设备日志字段。

## 本地原始证据

- `/private/tmp/search-selection-probe.mjs`：直接执行真实Index普通方法（SDK提取）/Coordinator/Gateway/分组；只mockRPC边界，不改源码。
- `/private/tmp/search-selection-probe-results.json`：8项结果与操作计数；`/private/tmp/search-selection-probe.log`输出。
- 首次探针组class装配把return放入TypeScript module导致工具层语法错误，修为strip后return再运行；不算生产缺陷。


## 当前实施与闭环约束（本轮已授权，不再作为待用户决定）

| 编号/能力/目标 | 入口与状态 | 当前修复 | 阶段/缺口/关闭条件 |
|---|---|---|---|
| PH68 SEARCH：大量来源搜索时保持交互 | 搜索→结果/部分成功/停止/返回恢复；原生spinner保持 | 页面只上报实际可见最多6组；相同引用不重发；目录队列最多2并发；不扫全量结果预热；计数更新不做额外seed复制。root另负责源列表revision共享、搜索缓存identity增量、迟到别名合并。 | P1/B1性能；代码/本地计数已证，当前修订帧率尚无VM/真机证据。不得把桌面总yield耗时当手机连续阻塞。 |
| PH69 DETAIL：默认候选目录失败可进入可用源 | 同一本书搜索组点击；空TOC/源解析/HTTP失败→下一候选；全部失败保留失败详情 | 真正openRemoteBookDetail调用共享acquireCandidateGroup；已知目录成功优先；未知最多3个新准入，已成功候选不受未知预算；每identity一次。只有默认搜索组可自动恢复，在架/继续阅读/事务换源/用户手选某源不自动替换。取消、identityMismatch、sourceVersionChanged、storageFailure、unsupportedHost立即停止。只最终选中来源进行正文准入。 | P0/B1主链；16项真方法回归覆盖，必须保留每源失败记录和最终选择的准确sourceId/bookId/variables；不新增书架行，不写进度，不跨书合并。 |
| PH70 SWITCH：复用搜索候选与已解析目录 | 详情更换书源首屏/后台补全/空候选/刷新/关闭 | 本次SearchBook组同步投影首屏，保留variables；再合并Core缓存且启用源版本验证。首次一遍缓存，后续dirty identity只get，不反复source.list/list。普通空缓存仅补原search尚未dispatch来源；明确刷新查全；无后台全候选正文探测。预览选择继续复用Coordinator已有session。 | P1/B1重复I/O/交互；真实Index首屏先于sources RPC、两候选0搜索；重复dirty一次get；源删除/规则失效不能被旧候选复活；准确个案当时是否实际重搜仍无payload，旧84也已有cache-first，不虚造旧包HTTP轨迹。 |
| PH73 SEARCH/DETAIL：目录预解析与生命周期一致 | 可见→隐藏→恢复/滚动/新query/来源变更 | 预解析只目录；失败同组有限续候选；隐藏不派发、已获准共享工作自行结算，取消只释放原owner的attempted、恢复可重试；新query清旧候选队列。刚完成prepared直接复用，真正过期才后台刷新。后台Promise立即有失败消费且仍可由前台await拒绝。 | P1/B1资源/取消；并发/6组/未知3预算、隐藏恢复、新query旧失败不续源、stale刷新拒绝均真实方法PASS。 |

这些是Reader业务调度/投影/身份准入的薄适配，继续使用现有Core解析、缓存事实、BookRequestScheduler、ArkUI List/LoadingProgress；没有新增解析器、通用匹配/缓存淘汰算法，也未复制Legado GPL实现。Legado普通搜索不全TOC预解析、详情失败不自动轮询候选；本轮自动恢复是已授权Reader需求，不能声称直接复刻Legado。已有Figma样式/搜索原生loading/列表锚点不改。

### 生产方法与失效约束

- `BookAcquisitionCoordinator`：`BookAcquisitionCandidate`/`BookAcquisitionChange`；`prepareGroups`/`setPreparationVisible`/`acquireCandidateGroup`。`subscribe`保持旧无参listener可兼容，16ms合批携带真实dirty identity，source mutation前后reset。解析成功/失败的事实仍存Core，owner变更后旧事件不能重建用户删除来源。
- `SearchPage`：`publishVisibleGroups(start,end)`从List可见index取组；最大6，元数据同引用不重发；停止/离开清可见集合。`searchCandidateRank`只读同sourceRuleVersion的新鲜catalog/readable/failure事实；只是选择同组默认代表，不改用户固定选源。
- `Index`：`searchDetailCandidates`保存同组确切SearchBook；默认组fallback调用一处真实Coordinator，已删无生产调用`openSearchSessionCacheFirst`。保留另一任务的`retainedDetailReturnRoute`，换源/试读/返回仍回原搜索。同步候选首屏与异步缓存序列化，首个慢读不覆盖后续dirty更新。
- `SourceSwitchGateway`：已知候选合并遵守启用源/版本；dirty读取校验返回identity，页面取消/来源revision变更后不发布旧数据。缓存空状态有明确恢复路径，非空原候选不被重新搜索替代；完整主动刷新保留原成功候选。

### 回归与证据层

- 修前8项真实方法观察：`PH68-73-before-probe.json`（脚本当时绑定29d1bb4a/父任务后续整合前版本），不是手机采样。
- `tools/test-search-candidate-acquisition.mjs`：16项PASS，实际Coordinator/Gateway/SDK提取Index与Page方法；RPC边界用固定样本。覆盖6可见组/并发2/无正文、同组目录失败续源、未知3/已知不受限、5类阻断错误、隐藏恢复、新query、fresh复用/stale拒绝、dirty事件、Index首源失败次源成功且仅最终正文、shelf/explicit保护、可见范围去重。
- `tools/test-source-switch-gateway.mjs`：原专项及新增已知候选、精确dirty get、源配置失效、补缺与完整刷新、实际Index同步首屏PASS。
- `tools/test-book-acquisition-coordinator.mjs`、`tools/test-bookshelf-manual-update.mjs`、`tools/test-search-trial-reading-return.mjs`通过；旧用例“全候选最终正文”“新鲜prepared点开必须force”的相反预期按新授权约束改为保护TOC-only/单次HTTP，并保留主动正文/显式更新的实际业务验证。
- 首轮旧fixture缺sourceRegistryRevision/新增页面字段及SDK方法依赖导致本地测试失败，已逐项补真实依赖后重跑；不是新增生产缺陷，也没有删有效断言规避。新生产方法提取的正式16项一次PASS。
- 独立审查发现的取消attempted残留/后台拒绝未处理均已修，并有`PH68-73-independent-review.json`交叉证明。

当前新行为仅代码接线与本地测试层，视觉V1；尚无本轮HAP/VM/真机验收，不提升至D5/D6/D7。用户真机仍84cdc4ef。父任务整合构建/签名/安装另记。

### 尚不能伪称通过的边界

1. 当次66书吧-起点的实际sourceId/version/bookURL与TOC响应没有采集；通用失败恢复已闭环，但没有证明那个源本身恢复。已有bundled特殊规则只用于定位入口，并非设备上的准确规则事实。
2. 根任务的增量SearchGateway/Orchestrator与本片最终统一门禁由root合并；本报告不替其尚在执行的结果先写PASS。
3. MainThread仍需对当前签名包量化交互帧率。已消除代码可定位的重复预热/正文/强刷/全库重复I/O，不用改loading动效来掩盖阻塞，也不宣称桌面RPC计数等于OEM流畅度验收。
4. 原全量实施计划、PH42多级目录与本批正文段落等其他owner范围保持独立，不因本片通过自动关闭。


### 冻结前最后一次检查

`PH68-73-local-receipt.json`绑定本片五个生产文件字节及10个相关检查的最终PASS；其中新增candidate专项16项。capsule独立补齐3个旧fixture并通过，实际List.onScrollIndex SDK声明支持start/end/center（本片使用start/end），保留已有滚动锚点恢复。旧navigation-performance对sessionAdmission紧邻文本的约束因加入三元分派而失败；保留非fallback分支单identity缓存准入的约束后已PASS，不通过改生产来满足过时正则。此处测试代码/日志不是HAP构建或设备验收。

本片生产/测试已冻结，root正在完成共享SearchGateway/Orchestrator集成及统一门禁。后续若编译检查发现明确问题，再记录定点修复，不自行操作设备或提交。

### PH70 追加：候选增量读取失败会丢失已消费批次（代码审查发现）

Root 复核发现 `Index.startSourceDiscovery.refreshProjection` 先清空 dirty/reset，再读取候选；原空 catch 未归还失败批次。实际 Index + SourceSwitchGateway 回归已复现：A 的 `search-book.get` 暂时失败，稍后仅 B 事件到达，实际只读 B，预期读取 A+B；红证据 `/private/tmp/ph70-dirty-retention-red.log`。本轮现象是当前未安装代码的本地失败，非真机新增观察。修复限定为当前页面 owner 仍有效时归还失败 batch，合并晚到 identity/reset；失败本身不触发自动重试，不取消/复活旧页面。

PH70 补修结果：`tools/test-source-switch-gateway.mjs` 全部通过；新增实际 Index + Gateway 两条链分别覆盖“失败 A + 后续 B → A/B 都重读”与“失败 reset + 后续 B → 完整快照重读”，并保护没有新事件时不自动重试。绿证据 `/private/tmp/ph70-dirty-retention-green.log`。修改限定 Index 上述 catch、该测试及 Coordinator 过时注释（刷新依据是 `refreshRecommended`，不是 fresh prepared）。生产再次冻结，已由 root 整合提交至 Harmony `c9db86d1`；此处不宣称已入安装包。

### 附录：bundled 1027「66书吧-起点」完整 TOC 规则的有限离线审计

范围：不改 Core 生产/正式测试，不编译，不真实联网，不操作设备；使用现有 CLI 和内存 Runtime。用户当时真机仍为 84cdc4ef；以下是规则/本地证据，不能代替《鸣龙》个案的请求响应或设备结论。

**准确身份与历史证据**

- Harmony bundled 集合零基索引 1027 的 `sourceId=corpus-d510a10eb1ba`、`builtinVersion=6`、`ruleFingerprint=fa759f5fbf924b1a0ca073891f987de2d5c8f19e886cc3f2eb2f06215d007699`；provenance 指向 Core `tests/fixtures/corpus/sources/src-669-d510a10eb1ba.json`。两者完整 `ruleToc`、`jsLib` 逐字段一致。不能仅凭显示名认定用户当时选中的就是这个身份/版本。
- Core `reports/tooling/corpus-batch-live-full-1945-v5-2026-07-09.json` 精确该身份记录：关键词《斗破苍穹》、20 搜索结果、选择 `https://m.qidian.com/book/1209977`、1681 目录项，L1–L5 标记通过；第一条目录 URL 是 base64 内联数据 + `{"type":"qtqd"}`。这是 2026-07-09 的 CLI 历史记录，不是当前实机通过。该条 `has_js=false` 是历史报告元信息错误，实际 ruleToc 明确含 JS，不能据此说目录不执行 JS。
- 在当前 Core `reports/tests/samples` 含 ignored 文件的限定文件名检索中，没有找到该身份原始 HTTP recording，只有源码 fixture 与汇总报告。不能把报告中的通过摘要当作可直接回放的完整响应。

**完整规则需要什么**

`jsLib` 定义 `ho=https://m.qidian.com`；搜索规则据起点 ID 形成 `ho/book/<id>/`。目录规则使用当前 `baseUrl.match(/(\d+)/)[1]` 取 ID，再通过 `java.ajax` 请求 `https://wxapp.qidian.com/api/book/categoryV2?bookId=<id>&_csrfToken=`，解析 `data.vs[].cs[]`。每项依赖 `id/cN/sS/uT/cnt`，返回数组对象；裸字段 `title/url/v/t` 继续被提取，URL 是 base64 的 `{bookId,id,v}` 加 `qtqd` 描述。`ruleBookInfo.tocUrl` 为空，所以当前书籍 URL 的传递必须正确；不能把 source 首页当作当前书籍 URL（域名里的 66 也会匹配数字）。当前 Runtime `remote.rs:7506` 优先实际 initial URL，其次明确 tocUrl，传给 `toc_with_next`；本次成功探针确认 book URL 的 123456 被正确使用。

**现有正式测试已覆盖的部件**

- `reader-content/src/lib.rs` 的 `toc_chapter_list_js_receives_request_context`：JS 的当前 baseUrl；`toc_ixdzs_js_post_array_items_parse_as_chapters`：真实 callback → JS 返回对象数组 → 裸 title/url；`toc_bare_keyword_chapter_name_on_jsonpath_item`：裸 JSON 字段兼容。
- `reader-js` 的 ajax descriptor/回包、base64 编解码测试分别覆盖对应桥接能力。
- `reader-content/tests/analyze_url.rs:1480` 的 `url_dsl_tolerates_string_type_value_qtqd` 明确覆盖 66shuba 家族的非数字 type 描述；不能误报整个 qtqd URL 不支持。
- 这些是组件/相似链覆盖，当前正式测试代码未找到精确 `categoryV2` 完整规则回归。普通 `--booksource-fixture` 使用 `RemoteContentPipeline::new()`，不注入网络 callback，单独塞 tocResponse 不能替代该规则的二次 ajax 响应。

**本次完整原规则的离线生产链探针**

直接使用现有 `target/debug/reader-cli --host-replay /private/tmp/ph68-66-exact-toc-replay.json`；完整 source/jsLib/ruleToc 原文未修改，`book.toc` 使用合成书籍 URL `https://m.qidian.com/book/123456/` 和合成初始 HTML，由 fixture 回答唯一一次 `java.ajax` Host 请求。没有网络 socket、构建或用户库读写。

- 产物 SHA256 `474a1483d9c7ba455636fe916a27b93035b6faea903cc0e6f663c108d88cc6bf`；`core.info`：gitCommit `bf3e2682051f0c5d84103800c1cec4e7140b203c`、gitDirty=true、buildId `ea1b9f24ed0930bf65ce9f6218214d23b7758fe78ee0ffebab8a7397cfd24730`。这是既有 debug 产物身份，不等同于最终 native/HAP 门禁。
- 合成 `data.vs[].cs[]` 有两章：真实 Runtime → JS → Host completion → TOC 输出 2 章。已结构化断言 exact ajax URL、两条中文标题、base64 里正确 bookId/章节 ID/VIP 布尔值、qtqd 描述均 PASS。证明该完整规则在合法结构下能执行，未发现普遍的数组/JS变量/目录 URL 适配阻塞。
- `data.vs=[]`：真实结果为 `toc:[]`；这是受控合成空目录，不能据此推断用户回包为空。
- 缺 `data` 的合成回包：首次完成后出现第二次同 URL `http.execute`；没有最终 result/error。现有 `host-replay` 只补一次 host.complete，所以虽然 CLI exit=0，也不能称该负例通过。
- 原始 fixture/log/带断言 receipt：`/private/tmp/ph68-66-exact-toc-replay.json`、`/private/tmp/ph68-66-replay.log`、`/private/tmp/ph68-66-exact-receipt.json`。

**明确新代码缺陷与最小处理建议（尚未修改 Core）**

`reader-rule/src/lib.rs:856` 的 JS pipeline 用 `if let Ok(result)` 丢弃 JS 执行错误；`reader-content/src/lib.rs:4908` 对空输出再次执行原 rule。纯 JS 条目本来不需要列表选择器补全，因此错误回包导致同一 `java.ajax` 执行第二次。本次负例的第二 Host request 与这条调用链对应，属于可证的重复 I/O/故障语义丢失，不是已证明站点异常，也不能说《鸣龙》当时一定走过此分支。

建议限定 Core 后续修复：只有补全 selector 与原 rule 不同、且确实需要 legacy fallback 时才重试；目录严格策略保留 JS 失败阶段/原因，避免将执行异常与合法空数组混为一谈。回归应覆盖精确该规则的成功数组、空数组、缺 data/非 JSON/Host 拒绝，并计数每个原始请求；保留现有选择器 fallback 合法行为。本审计未修改 Core；root 已将上述重复执行边界交由 minglong_text_audit 限定修复与真实 callback 计数回归，完成状态以其后续证据为准，不依据未知实际回包随意改书源。

**《鸣龙》个案仍缺的输入**

当次真正 sourceId/规则版本、选中 bookId 与传入/最终 tocUrl、categoryV2 的状态及响应结构/JS error（含响应摘要即可，不能公开会话凭据）。当前本地没有这些事实，所以不能把可能的空目录、响应结构改变、身份/URL上下文或 Host 会话中的任一个猜测当作个案根因，也不能宣称该源/该书已恢复。已实现的有界同组 fallback 和候选复用是通用闭环；与个案真实回包证据分别记账。

附录产物已固定至本目录：`PH68-66-exact-toc-replay.json`（合法完整规则回放）、`PH68-66-missing-data.json`（缺 data 负例）、`PH68-66-replay.log`、`PH68-66-missing-data.log`、`PH68-66-exact-receipt.json`、`PH68-66-info.log`。这些均为合成响应的离线证据，不含真实设备响应或会话凭据；Core 修复 owner 已收到，后续不扩展 source/network 范围。
