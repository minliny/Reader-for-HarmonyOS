# 《鸣龙》书源规则与正文层审计（只读，2026-09-15）

## 1. 审计身份和证据边界

- 当前 Core：`0c5a3956274197578554f36b1a7fed9e1977ea78`，`main`，本次探针读取时工作区干净。
- 当前 Harmony 已提交基线：`3843792ab06ee1025d06d44d9666fbab2bd6f63f`；PH76 ArkWeb 修复由其他 agent 正在工作区实施，本报告不把未提交代码视为该 HAP 已包含。
- 用户手机最后确认交付：`20260914T154527Z-1d1f47e5-41357e27`，Harmony `1d1f47e5` / Core `61a2f86e7`，HAP SHA `1771b5ad75b42c6f56704adbf1f722788816dd840163ff5cda69adab99aa5def`，15:46:24 UTC 保数据安装。不能将后来的 Core 0c5 / VM 384 修复认作手机已经生效。依据：`Reader-for-HarmonyOS/evidence/2026-09-14-physical-review/FEEDBACK.md:116`。
- VM 最新已安装基线：`20260914T190706Z-3843792a-773d63a4`，Core `0c5a39562`，HAP SHA `badce494ce3429906ff25c066d97a5e7babb58f8ad260a70f90350923b211f07`。其 DNS/fake-IP 现象不是用户手机失败的归因证据。
- Legado 仅作只读语义参考：`/Users/minliny/Documents/legado`，固定提交 `6763d061bc92b2164ac274363a807e4ed4be34e2`；没有复制 GPL 实现。
- 本次没有网络请求、HDC、设备操作、生产修改或 Git 修改。新增的是 `/private/tmp/minglong-source-content-audit/` 内的临时探针和证据。
- 当前源码库离线增量构建成功后，临时探针链接其真实 `reader-content` / `reader-js` / `reader-domain` 库，使用完整内置原规则，只有 HTTP 回包由 callback 提供合成值。19 个受控输入均完成；其中失败/错误正文是发现的问题，不是“19 项业务通过”。这是可复现兼容证据，**不是实际《鸣龙》HTTP 样本**。

本文相对路径前缀：Core=`/Users/minliny/Documents/Reader/Reader-Core-Native`；Harmony=`/Users/minliny/Documents/Reader/Reader-for-HarmonyOS`。

## 2. 可以精确识别的书源

内置合集共 1046 项，位于 Harmony `entry/src/main/resources/rawfile/reader-tested-book-source-collection.json`。用户点名能够关联到以下内置候选，但未读取手机源表，不能确认手机使用的精确 sourceId / 导入版本 / 用户修改规则。

| 内置显示名 | 源 ID / 合集索引 | 规则文件 | 版本与同源关系 |
| --- | --- | --- | --- |
| 松鹤阅读 | `corpus-9f23ceb11a82` / 134 | Core `tests/fixtures/corpus/sources/src-2869-9f23ceb11a82.json` | builtinVersion 6；指纹 `d53a66cfd1feee274fe905d507fbc67c4931ca6e3cb4e3a44b4f7b638227f7d8` |
| 66书吧-起点 | `corpus-d510a10eb1ba` / 1027 | Core `tests/fixtures/corpus/sources/src-669-d510a10eb1ba.json` | builtinVersion 6；指纹 `fa759f5fbf924b1a0ca073891f987de2d5c8f19e886cc3f2eb2f06215d007699` |
| 66书吧 | `corpus-77a537664348` / 57 | 合集同名项 | 与上项相同规则指纹；不能凭相似名称当作不同独立实现 |
| 66书吧-起点-一直被狗举报 | `corpus-96d79f9f79bf` / 126 | 合集同名项 | 与上项相同规则指纹 |

“其余源”的实际手机候选列表、精确 bookUrl 和失败阶段未留存。本地唯一额外命中《鸣龙》的旧 corpus 是 `reports/tooling/s3-p0-rerecord-2026-07-05/recorded/corpus-be6c881a5eeb.json`（笔趣阁🎃#47）：它是在另一书、另一搜索词的正文 HTML 页脚推荐链接中出现《鸣龙》，没有作者对应关系。**该线索不能提升为用户本次搜索候选，更不能据此评判该源成功/失败。**

## 3. 松鹤阅读：JSON 段落数组问题已修，但需区分当前规则、异常类型和旧缓存

### 实际链

规则文件 `src-2869-9f23ceb11a82.json`：

1. 搜索：`searchUrl:62` 使用 `so.html5.qq.com`；`bookList:47` 为 `$.data.state[?(@.dataName == 'novel_search_list')].items[*]`。书名 `$.title`、作者 `$.author`，`bookUrl:48` 将 docId 转为 `bookshelf.html5.qq.com/qbread/api/novel/intro-info` 请求。
2. 详情：读取 resourceName / author / summary / picurl / lastSerialname 等字段；`tocUrl:28` 使用 `$..resourceID` 拼 `qbread/api/book/all-chapter?bookId=...`，并通过 `@put:{bid:...}` 保存变量。
3. 目录：`chapterList:56`=`$.rows`、名称 `:57`=`$.serialName`；`:58` 为 `novel.html5.qq.com/be-api/content/ads-read` POST 描述符，JSON 中 BookID 来自当前 baseUrl 的 bookId，ChapterSeqNo 来自 serialID。请求方法、参数、Referer、源静态标识头和变量必须保持；本报告不输出静态标识值。
4. 正文：`:32` 原规则为 `<p>{{$.data.Content[0].Content}}</p>`；没有正文 JS / replaceRegex / sourceRegex。书源类型为 0；enabledCookieJar=false，没有登录规则或 jsLib。不能因为 API 请求失败便推定为 Cookie 或反爬问题。

### 本次受控探针（真实当前 Core 和原规则）

| 输入 Content 类型 | 当前实际输出 | 结论 |
| --- | --- | --- |
| 字符串数组，成员含实际 CRLF | `第一段\n第二行\n第三段` | 已正确按段落合并、正常换行 |
| HTML 段落数组 | `第一段\n第二段` | 已正确移除 HTML 包装并保留段落 |
| 单字符串含实际 CRLF | 两行纯文本 | 兼容 |
| 数组中合法字面 `\\r\\n` | 保留这些字面字符，其余段落 LF | 没有全局危险解码 |
| number 42 | `42` | 规则字符串投影保留类型语义；不等于可读章节 |
| JSON null | `null` | Core 正文非空，但当前 Host 最短正文规则会拒绝这个 4 字符文本 |
| 空数组 | 空文本 | 正常产生空正文 |
| 嵌套对象/数组 | 保留嵌套 JSON 文本 | 没有随意拆坏结构；若接口将其放在正文位置，需要类型/结构证据判断 |

定位：Core `crates/reader-rule/src/lib.rs:2900` `project_json_path_text` 对文本模式的 definite JSONPath 数组使用既有投影 LF join；`:5293` 保留其他 JSON 值的原字符串化语义。Core `crates/reader-content/src/lib.rs:14760` 等 PH85 正式回归覆盖原规则。Legado `AnalyzeByJSonPath.kt:34–53` 的列表文本 join 证明了该适配方向；不要将它推广成所有 JS 数组和请求参数都换行。

历史另一个已修目录问题：literal tocUrl 中 `@put` 曾污染实际 bookId 请求，当前正式回归 `crates/reader-content/src/lib.rs:10832` 已覆盖剥离变量再解析 URL 描述符。历史其他书成功不代表本次《鸣龙》实时接口成功。

### 当前仍不能据此关闭的问题

- 没有用户《鸣龙》实际 Content JSON，无法判定剩余 `[ \\r\\n` 是旧格式缓存、上游双重编码字符串、另一版本规则或正文选错字段。已修数组类型不意味着可以继续全局删括号/反斜杠。
- 普通命中缓存不重取。Core `remote.rs:212` current format=2；`:9358` 旧格式只返回 contentRefreshRequired；`:9538–9573` 新取正文使用 format2 参与 hash 和写入。旧 format1 需要对当前章显式“更多→刷新”，走 PH75 位置保护。
- `remote_content_positions.rs:1093/1189/1229/1258` 正式回归分别覆盖旧数组成功映射、无法映射 preserved、普通读只读和新正文一致 hash。不能清全书缓存、盲目重跑 JS 或移动旧偏移。失败/无法映射时旧正文和位置保留，不能提示刷新成功。
- JSON null / number / object 在通用规则层是否有业务意义，必须保留；应在**正文提取结果的类型/来源准入**与源规则层区分异常，不在正文 UI 搜索替换这些字符串。

## 4. 66书吧-起点：搜索、目录、正文是三条网络阶段，存在确定的异常退化

### 实际链

规则文件 `src-669-d510a10eb1ba.json`：

1. `jsLib:16` 给出 `ho=https://m.qidian.com`；搜索 URL `:85` 基于 ho。`bookList:62` 为 `@css:div.y-list__content>div.y-list__item`，name=`tag.h2@text`，author=`p[class^=_searchBookAuthor]@text`。`bookUrl:63` 从 `href="//m.qidian.com/chapter/(\d+)/0/"` 提取书 ID，转换成 `/book/<id>/`。
2. 详情字段依赖 `.detail__header...` 的 HTML 选择器；tocUrl 空，继续使用实际书 URL。搜索 HTML 结构命中不证明详情 HTML 结构仍命中。
3. `chapterList:74` 是完整 JS：从 baseUrl 取数字 ID，`java.ajax` 请求 `https://wxapp.qidian.com/api/book/categoryV2?bookId=...&_csrfToken=`，直接 `JSON.parse(result).data.vs.map(...cs...)`。返回对象数组 title/url/v/t；章节 URL 是 `data:;base64,<JSON{bookId,id,v}>,{"type":"qtqd"}`。
4. `content:38` 先 `java.hexDecodeToString(result)`，解析章节描述，再按 vip 分支请求 `https://66shuba.com/api/novel/chapter/<bookId>/<cid>` 或 `/vip-chapter/...`。最终赋值 **`response.data?.content || response.message`**；内外 try/catch 用 `java.log` 输出解析错误。
5. enabledCookieJar=true、loginUrl/jsLib 存在；两个源族的普通搜索/正文描述均未声明 webView/sourceRegex。这些字段有语法支持不代表接口当前可访问、登录有效或实时 HTML 未变化。`tests/analyze_url.rs:1480` 只证明 qtqd 描述符语法被接纳；原 TOC fixture 证明其对象数组/URL产出，不证明真实 66 正文接口可用。

### 本次真实生产方法探针的确定输出

所有行都使用完整同一原规则、合成书 ID 和合成 HTTP 回包；每个 case 只发生 1 次 fake `java.ajax`，无真实联网。

| 阶段 / 合成回包 | 当前 Core 输出 | 失败归属与边界 |
| --- | --- | --- |
| TOC 合法 1 章 | 1 章 | 原规则对象数组链可执行 |
| TOC 合法 data.vs=[] | 0 章、成功返回 | 合法空结果 |
| TOC 缺 data，仅 code/message | 0 章、成功返回 | JS 异常被规则层吞掉，与合法空结果混淆 |
| TOC 非 JSON HTML | 0 章、成功返回 | JSON.parse 异常被吞，同样丢失原因 |
| 正文 data.content=正常字符串 | LF 正文 | 正常内容链可执行 |
| 正文只有 message | `synthetic upstream unavailable` | 原规则主动把错误信息当最终正文 |
| 正文 data.content="" + message | `synthetic rate limit` | 空正文的错误 message 回退成正文 |
| 正文 data.content=字符串数组 | `["第一段","第二段"]` | JS 路径按 JSON 字符串化；PH85 JSONPath 文本数组修复不会改该链 |
| 正文 data.content=对象 | `{"unexpected":"object"}` | 同上；不能当正常段落结构 |
| 正文非 JSON HTML | `解析响应JSON失败: SyntaxError: unexpected token: '<'` | 原规则 catch 的 java.log 返回值成为脚本结果/正文 |
| 正文缺 data 和 message | `null` | JS undefined 经 JSON 桥变成字符串 null；Core 非空不等于 Host 最终可读 |

### 代码根因和正确修复边界

**A. 目录错误原因被吞：确定的应用诊断缺陷。**

- Core `crates/reader-rule/src/lib.rs:879–902`，特别 `:896`：`if let Ok(result)=js.eval(...)`，Err 没有保存或传播。
- `crates/reader-content/src/lib.rs:4896–4960` 的 strict_response 只能传播 RuleEngine 返回的 Err，不能恢复已吞掉的 JS 失败。`item_rule==rule` 避免重跑的修复已有效，但没有修复原因丢失。
- 正式 `crates/reader-content/tests/toc_rule_single_execution.rs:12–60` 目前把缺 data 与合法空数组都期待为 0 章，只验证 ajax 不重复。本次增加非 JSON 合成探针亦复现相同缺口。
- Legado `AnalyzeRule.kt:312–355` / `:893–935` 在这些调用点直接执行脚本，未见相同的静默丢弃分支。Core 注释“mirrors Legado”不能替代可验证错误合同。
- 修复应复用现有 RuleError / JsOutcome，保留 stage + 失败类型及 source/book/request 身份；TOC strict 路径区分执行失败与成功空列表。继续保持合法空数组语义和单次 callback，不为了诊断再次执行规则。不能将所有可选字段失败一概升成整书失败；先限定必要列表/正文终点，随后补可选字段容错兼容测试。

**B. 错误信息可成为正文：已复现的原规则风险 + 应用准入缺陷。**

- 源规则的 message fallback/catch 是直接诱因。`reader-js/src/lib.rs:2287–2306` java.log 返回消息与 Legado `JsExtensions.kt:1156` 返回 msg 一致。**不能改 java.log 为 undefined 来“修复”这个源**，会破坏兼容。
- Core `reader-content/src/lib.rs:1766–1777` 将 JS Null 保留为 `"null"` 给后续 JSONPath；`:1905–1924` 对数组/对象 stringify。结构化中间态仍有必要，不能直接全局 LF join 或把所有 null 清空。
- Core `remote.rs:9512–9518` 只拦截 trim 为空；当前 acquisition `remote/acquisition.rs:548–575` 的正文证据验证证明身份、版本和非空可见文档，不能证明这些字符是实际章节。
- Host `features/reading/RemoteContentAdmission.ts:152–180` 是长度和标记启发式，超过 BANNER_SCAN_LIMIT 会直接 readable；Gateway `RemoteReadingFlowGateway.ts:548–569` 才执行此最终门禁。本子任务探针执行 Core，父任务随后将 15 个 content 输出送入真实同版 Host 分类函数，本次已读取结果：66 的 message-only、空 content 的 message、JSON array/object、JSON 解析错误日志，以及松鹤 nested 全被判 readable；两源的 null、松鹤 42 和空数组被拒绝。证据为 Harmony `evidence/2026-09-14-physical-review/minglong-full-assessment/core-host-body-probes.jsonl`。**不能把 Core 非空和 Host 最终通过混为一层；这些特定伪正文通过两层已得到受控生产方法证明。**
- 最小修复方向：给当前源规则/API envelope 做明确成功字段和内容类型校验，失败输出结构化原因而不是 message 作为章节；应用终点保留提取类型/异常证据，再与 Host 准入统一。先补 exact-source fixture 验证正常 string、message-only、无字段、非 JSON、array/object；没有真实 API 样本前不得擅自断言数组就是合法段落，也不得增删源凭据或关闭所有在线源。
- 通用异常判定不应继续堆正文关键词。长登录页面、错误日志、JSON 残留与正常小说中引用代码可能重叠，需要结构证据；正常段落中的 `null`、方括号、`\\r\\n` 不得被删除。

## 5. 全量失败链的边界

1. **搜索成功只证明搜索阶段。** 66 后续跨 `wxapp.qidian.com` 和 `66shuba.com`，松鹤跨 intro/all-chapter/ads-read。每一步都可能独立遇到 HTTP/格式/字段/规则问题。现有两个明确名字不足以给“大量候选”逐源定因。
2. **预解析与正文准入必须闭环。** 父任务已定位当前预解析 detail+TOC，正文失败不自动再试同组、候选上限3且部分 capability 失败中断。源层此次发现说明 TOC 非空与正文真正可读必须分层；单纯扩大试源个数解决不了伪正文/原因丢失。调度修复由父任务另写，不属于本子任务生产范围。
3. **WebView/反爬不能混为一谈。** PH76 在 VM 384 有真实旧导航资源回调进入新 job 的确定应用缺陷，修复中；但上述两个实际内置源链并没有 webView/sourceRegex 描述，不能让 PH76 包办它们的失败。其他实际失败候选是否用 WebView，要先拿 sourceId 和规则版本。
4. **缓存隔离。** 源版本/正文版本的真实性校验不能倒推出缓存文字质量；旧错误正文已有位置时继续遵守 PH75 显式单章受保护刷新。不能清库或全书迁移来让探针变绿。
5. **尚缺输入不是新的产品决策。** 不需要用户定义规则/接口，只需在既有诊断链补最小可关联收据；优先从当前运行日志/已有搜索结果状态拿，代码侧可复现的先修，不立刻请求新真机占用。

## 6. 后续最小取证与执行探针

### 最小每候选收据（不能采集凭据）

- sourceId + 当前规则 fingerprint / 来源版本；规范 bookUrl，搜索关键字与命中的 name/author；组内成员列表。
- requestId、stage（search/detail/toc/content）、Host operation id、起止时间、HTTP status/finalUrl/contentType/响应字节数及 hash；记录 JSON 字段/类型轮廓、CSS 命中数，不在报告输出 Cookie/Authorization/静态用户标识。
- JS 成功/异常类别、实际调用次数、能力错误类别；空列表与异常空列表区分。响应含反爬提示需要原始响应分类证据，不能从耗时或 HTTP200 推定。
- content 原始类型/提取类型/最终投影类型、TOC 条数、body/processing/source version、cache format、via、positionMigration.status；每个失败保留到替代候选成功或组终态。
- 只针对当前《鸣龙》实际已出现的候选；不全库扫源。必须联网重放时先绑定现存精确书 URL/规则和合法公开接口，禁止从未知 ID 猜源/书身份。

### 已执行的当前生产探针

目录 `/private/tmp/minglong-source-content-audit/`：

- `probe.rs`：读取完整 exact 66/松鹤源，直接调用生产 RemoteContentPipeline；19 个合成 shape cases。
- `current-libraries.jsonl`、`current-libraries.log`：`cargo build -p reader-content --locked --offline --message-format=json` 当前库身份。离线增量完成，不是 Native/HAP 构建。
- `compile-command.json`、`compile.log`：实际 rustc 连接命令及结果；`identity.json` 保存 Core HEAD/dirty、源探针 SHA 与四个链接库 SHA。
- `results.jsonl`、`probe-stderr.log`：逐 case 输出与调用次数；无网络、无设备。
- 当前 `target/debug/reader-cli --info` 仍报告旧 `316ed8362`，因此本轮没有用它冒充当前 0c5 的回放结果。

### 可直接运行的正式生产回归（建议；本子任务没有重跑整套）

在 Core 根执行：

```text
cargo test -p reader-content --locked --offline --test toc_rule_single_execution -- --nocapture
cargo test -p reader-content --locked --offline ph85_ -- --nocapture
cargo test -p reader-rule --locked --offline ph85_ -- --nocapture
cargo test -p reader-content --locked --offline detail_toc_url_literal_template_strips_put_before_url_dsl_options -- --nocapture
cargo test -p reader-runtime --locked --offline format2_ -- --nocapture
```

下一轮修复必须把临时 66 异常正文/TOC 原因测试移入现有实际 Core 测试，断言结构化失败，而不是只断言非空或包含提示词。当前 Host 生产分类已接收这些探针输出并证明上述伪正文漏检；修复后必须以同一链复测业务终态，保留正常正文/合法字面代码/合法空目录，以及 PH75 无法映射 preserved 的保护回归。

## 7. 收口状态

- 已确定、可在代码侧修：必要规则 JS 失败原因被吞；66 原规则错误信息/异常日志变正文且当前准入缺乏结构证据；当前 JSONPath 修复不覆盖 JS 输出类型，不能泛化宣称已处理所有数组。
- 已修且本次当前库再次复现正确：松鹤实际段落数组 CRLF/HTML 与合法字面转义的区分；66 相同 TOC 规则不重复 ajax。
- 不足以确认：用户手机精确源版本和各候选实际 HTTP 返回；另一些源失败的确切类别；66 实时接口支持哪些 content 类型；松鹤当前用户章是否仍用旧缓存。
- 本报告没有生产变更，不宣称完成全部源适配或手机验收。后续修复不需要新增用户产品决策，需要闭环既有失败证据和阶段合同。
