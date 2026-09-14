# PH85 松鹤阅读正文数组被序列化为文本

## 现象与证据边界

用户在最新真机包反馈：《鸣龙》选择“松鹤阅读”后，正文已经换行，但仍残留大量方括号、引号及字面 `\r\n`。本次先审计源码，再用真实 Core 生产方法与内置原规则构造最小响应复现；没有操作设备、访问网络、读取用户正文或修改书籍/缓存。身份记录见 `identity.json`。审计基线 Core 为 `61a2f86e7287fb276757706ba436a8103dcb3d37`；Legado 只读参考提交为 `6763d061bc92b2164ac274363a807e4ed4be34e2`。

当前内置源身份为 `corpus-9f23ceb11a82`，源名“松鹤阅读”，固定语料 `Reader-Core-Native/tests/fixtures/corpus/sources/src-2869-9f23ceb11a82.json:31`。它的正文规则只有 `<p>{{$.data.Content[0].Content}}</p>`；没有正文 JS、replaceRegex 或 sourceRegex。Harmony 内置集合中的规则与此固定语料相同。报告不复制源请求头或完整书籍正文。

历史全语料报告 `Reader-Core-Native/reports/tooling/corpus-batch-live-full-1945-v5-2026-07-09.json:1316` 确有这个源的旧测试，但仅记录另一本书的长度、摘要哈希和段落数，未保存可证明本次《鸣龙》响应类型的原始 JSON；历史“L5 pass”不能证明这次字符问题通过。

## 确定原因

旧链路：`content_book_source` → `extract_rule_value_mut` 的文字模板 → `expand_template_sub_rule` → RuleEngine JSONPath → `json_value_to_rule_text`。最后一个函数对 Array/Object 执行 JSON 序列化，之后模板把产生的 JSON 文本插入 `<p>`，HTML 规范化只能处理标签，无法知道方括号和转义是数组包装还是合法正文。

`results.jsonl` 是修复前生产方法输出，`results-fixed.jsonl` 是同一探针修复后的输出：

| JSON 字段类型 | 修复前 | 修复后 |
| --- | --- | --- |
| 段落字符串数组，元素内真实 CRLF | 数组括号、引号和转义 CRLF 被当正文输出 | 段落与真实换行均为 LF |
| HTML 段落数组 | HTML 产生换行，但数组括号、引号、分隔符仍残留 | 干净的两个段落 |
| 普通字符串，含真实 CRLF | 正常换行 | 保持正常 |
| 数组元素中的合法字面 `\r\n` | 被额外 JSON 编码 | 保留原字面 `\r\n`，仅在元素之间换行 |

这确定了能够精确复现反馈形态的通用兼容缺陷。尚未取得真机该章原响应，故不把其实际 Content 类型或上游返回版本当作已确认。

Legado `AnalyzeByJSonPath.kt:34–70` 的文字 getter 对 List 进行 LF 拼接；`AnalyzeRule.kt:773–800` 的规则模板调用文字 getter。结构读取与文字读取必须在 JSON 类型尚未丢失时分开。本次只复现这些可观察语义，未复制 GPL 实现。

## 实施范围

- `Reader-Core-Native/crates/reader-rule/src/lib.rs:465`：给既有规则引擎增加显式文字读取模式，原 Elements/URL 模式保持结构表示。既有 JSONPath 解析、求值、组合、函数、替换后缀和请求级解析复用仍共用原路径。
- 同文件 `project_json_path_text`：在 `serde_json::Value` 上对确定路径选中的数组做一层 LF 拼接；字符串原样保留；数字、布尔、null 使用原标量表示；嵌套数组/对象保留 JSON 结构。通配/递归等非确定查询已经有外层匹配集合，保留其内部结构，不递归压平。空数组允许文字 OR 分支继续回退。
- `Reader-Core-Native/crates/reader-content/src/lib.rs:2193`、文字字段分派及文字模板：正文/普通文字字段调用文字模式；JSON 请求模板、URL 字段、目录元素读取和结构结果保留原模式。纯旧式 `{$...}` 文字模板在展开后直接作为文字返回，避免被再次当成选择器。
- 同文件 JS bridge：复用现有带类型的 JSONPath 结果及标准 Array 操作，仅 `java.getString` 进行文字投影；`getStringList`/`getElements` 的结构表示不变。整章替换的 getter 仍读取第一响应并恢复当前 `result`，显式传入的内容优先。
- 没有全局反转义、无差别替换、括号删除或另一套 JSON/HTML 解析器。第一切片没有改源规则、请求参数、UI、Runtime、存储、分页映射或设备状态；随后授权的 Runtime 格式版本薄接见末节。

## 正式回归与失败记录

新增 5 组正式测试，位于上述两个 crate 的现有测试模块：

1. 原内置松鹤规则通过 `chapter_content` 入口验证字符串/段落数组/HTML/CRLF/字面转义/数字/空/null。
2. 文字字段、两种模板、JS getter、JSONPath→JS 串联；网络 JSON 模板与结构 getter 保真。
3. 整章替换 getter 的第一响应和当前结果上下文。
4. 数组类型、合法数组外形字符串、嵌套结构、非确定路径、缺失路径及解析 session 一致性。
5. JSONPath 数组文字投影发生在替换之前，组合规则及空数组 OR 回退正确。

末版执行 `cargo test -p reader-rule -p reader-content --offline`，34 个测试汇总段合计 **824 passed / 0 failed / 0 ignored**（含两个 0 例 doc-test 汇总）。记录：`related-crates-final-isolated-tests.log`。末版 `cargo clippy -p reader-rule -p reader-content --all-targets --offline -- -D warnings` 通过，记录：`related-crates-final-clippy.log`。`git diff --check` 通过。

失败没有覆盖：

- `results.jsonl`：原缺陷探针。
- `compile.log`、`compile-core-toolchain.log`：临时探针首次选错本地编译器/依赖产物组合，随后在 Core 固定工具链下用匹配依赖运行；不是生产构建失败。
- `ph85-regression.log`：新增旧式 `{$...}` 文字模板用例初次返回空值；已修文字模板分派，最终通过。
- `related-crates-final-tests.log`：新增组合测试和旧全局 split-cache 计数测试并发，导致上限计数失败及同测试锁中毒。新增测试现复用原测试锁；生产缓存和旧断言未改，末版完整两 crate 测试通过。

## 缓存及交付边界

本切片只修改新获取正文的提取语义，**不直接改写旧缓存或 offset**。审计时 Runtime 新正文 `content_format_version` 固定为 1，旧坏缓存也可能为 1；主任务需要集中调整当前格式版本与 refresh-required 判定，并通过已有 PH75 的显式升级、旧内容身份、位置上下文和原子映射发布更新。离线、网络/解析失败、位置无法证明时保留旧内容和原位置。该版本薄接已交 root/Runtime owner，本切片没有假定它已经完成。

已冻结：Core 文字语义修复、正式本地回归和上述证据。尚未执行本轮统一 workspace 门禁、Native/HAP 构建、VM/真机或用户验收。实际《鸣龙》该章的响应核对和缓存升级行为由主任务在相应证据层闭环，不以本地探针代替。

## 后续实施：格式 2 与受保护的显式刷新

上述缓存边界经只读审计后，root 授权了此最小接线。`CACHE_UPGRADE_PLAN.md` 保留审计依据与自动升级的额外前提；本节记录已落地部分。源码仍基于 `61a2f86e7287fb276757706ba436a8103dcb3d37` 工作树，其他 owner 同时有 PH78/PH90 修改；本 agent 没有提交、构建 Native/HAP 或操作设备。

- `reader-runtime/src/remote.rs:212` 新增单一 `CURRENT_REMOTE_CONTENT_FORMAT = 2`，普通缓存响应的 `contentRefreshRequired`、显式 `upgradeCachedContent` 判定、新正文哈希与缓存写入全部引用该常量。无稳定章节索引的预览也返回同一格式事实与正文哈希，但不写章节缓存。
- `reader-runtime/src/remote/remote_content_positions.rs` 的第一次正文写入、旧正文受保护替换、返回格式与哈希统一使用当前版本。无法映射时沿用旧正文、旧格式、旧哈希，仍返回 `preserved` 和 `contentRefreshRequired: true`。没有改变位置算法、事务、CAS、取消、时间戳、身份和处理配置保护。
- 原正文已被用户清理、仅留下 detached proof 时，精确重建仍使用 proof 内的格式 0 或 1，绝不冒充格式 2；不一致的正文继续拒绝恢复，保留全部位置事实。
- 普通缓存读取不自动请求、不清缓存、不扫描或迁移全书。**旧格式缓存仍需一次当前章节“更多→刷新”**，已有 Host 当前页坐标上下文进入 PH75；其他章节保持原样。若文字锚点无法证明位置，新正文不发布，旧正文完整保留。只把所读章节自动升级需要显式前台意图、完整坐标上下文和旧正文回退生命周期，本切片没有开启。
- 核对时 Host 确实还没有 `preserved` 的用户提示：LRE 仅处理 `committed`，Gateway 只转交迁移回执。已通知 root，其接手提示；本 agent 不把提示实现算作本切片完成。

正式新增 4 项测试（`remote_content_positions.rs:1093` 起），复用真实 `chapter_content_from_input → Host continuation → 内置松鹤文字规则 → finalize → PH75 publish`。响应内容为合成段落，零网络、零设备、无用户正文。验证：

1. 格式 1 数组包装去除后，捕获坐标 50→48，同时迁移进度、历史和有证明的书签；保留备注、时钟、设备、相邻章节，完整备份恢复后状态一致。
2. 章首 0、偏移 30、旧章尾三个不能映射的坐标返回 `preserved`；全存储快照前后完全相同，正文仍为旧数组文本，格式仍为 1，坐标未改变。
3. 普通格式 1 缓存立即返回且全快照不变；只有明确设置升级意图才产生取章请求。格式 2 即使再次带升级意图也命中缓存，不重复请求。
4. 第一次下载通过真实源规则产出格式 2，响应哈希与持久化正文及其格式一致，下载任务原子进入 Completed；无索引预览使用同格式和哈希、不产生缓存写入。

扩充既有 detached-proof 回归为清理 book/cache/all × 格式 0/1，恢复时全部维持原格式；同文格式 1→2 回归明确 bodyVersion 改变，processingVersion 不变。原分页及普通缓存的新下载格式断言从 1 更新为 2，没有放松其他断言。

最终定向结果：

| 命令 / 范围 | 结果 | 原始记录 |
| --- | --- | --- |
| `cargo test -p reader-runtime --lib --offline remote_content_positions -- --nocapture` | 22 passed / 0 failed | `format2-position-tests.log` |
| `cargo test -p reader-runtime --offline --test runtime_integration -- pagination:: search_content_commands:: cache_commands:: local_book_catalog_commands:: local_book_content_metrics:: sync_backup_commands:: sync_webdav_product_commands::` | 74 passed / 0 failed | `format2-integration-final.log` |
| `cargo clippy -p reader-runtime --all-targets --offline -- -D warnings` | PASS | `format2-clippy.log` |
| 4 个改动文件的 rustfmt 定向检查、`git diff --check` | PASS | `format2-final-checks.log` |

这里的 96 项测试含已有保护、分页、缓存、备份与本地阅读回归，不是整个 workspace 验收。`local_book_positions` 单元过滤命令匹配到 0 项，不计入通过数量；本地阅读证据来自上述实际执行的集成组。

保留首次失败：`format2-first.log` 中 3 个新 fixture 写了相对旧 URL `/1`、回包却用了绝对 URL，触发现有 `chapter_identity_conflict` 保护；已把 fixture 改成真实缓存使用的相同绝对身份，没有修改身份保护。`format2-integration-tests.log` 为首次误用独立 test-target 名称，仓库实际采用统一 `runtime_integration`；随后正确入口通过。无法映射的旧数组坐标仍是预期保留分支，不做假修复，也不宣称实际《鸣龙》用户缓存已经更新。

## 后续实施：Host 保留结果反馈

root 随后将提示切片交给本 agent，已完成。仅修改 `LocalReadingExperience.ets` 的保留反馈调用与新方法、既有 `tools/test-remote-position-reader.mjs`，没有改初始读章、书签绘制、控制栏接线或 Gateway。

此前直接在 `openChapter` 中调用 Toast，会在 UI context、PromptAction 或 Toast 抛错时落入正文加载失败分支。现有真实 LRE 生产方法回归首先复现：原本应保留的偏移 6 变成未配置，记录 `host-preserved-before.log`。现在 `notifyPreservedContentRefresh` 独立判断明确刷新意图、`preserved` 回执、当前生命周期及章节选择，然后捕获通知异常；在旧正文完成接纳后调用。提示为“为保留阅读位置和书签，本次未更新正文。原正文和阅读位置已保留。” 本地 SDK `@ohos.promptAction.d.ts:1880` 的 `showToast` 返回 void，因此不引入 Promise、定时器或重复通知任务。

真实 LRE 方法新增 **14 个有界场景**：普通/显式刷新 × 无回执/committed/unchanged/preserved，3 个通知失败点，读章与指标处理两处异步边界的旧 generation，以及指标未接纳时不提示。逐项断言是否通知、通知时已接纳正文，以及通知失败不影响原正文和偏移。原 PH75 恢复/书签/迟到回调/窗口/TTS 回归继续通过。

- `node --experimental-strip-types tools/test-remote-position-reader.mjs`：PASS，`host-preserved-final.log`；执行真实 ETS 方法，未复制提示逻辑。
- `node --experimental-strip-types tools/test-remote-position-migration.mjs`：PASS，`host-position-contract.log`；Gateway 旧坐标上下文、保留回执验证与 scoped 位置写入规则未变。
- `git diff --check`：PASS。

普通缓存的 `contentRefreshRequired` 只是格式事实，不是本次刷新被阻止的事实；当前显式刷新反馈只需已验证的 `positionMigration`，无须为这条反馈链扩 Gateway，也没有开启自动升级。这证明通知失败隔离、触发条件与生命周期处理，不证明 ArkUI 真机 Toast 的像素或用户验收。
