# 鸣龙链路：远程正文兼容修复交接

工作区 `/Users/minliny/Documents/Reader/Reader-Core-Native`；基线 `bf3e2682051f0c5d84103800c1cec4e7140b203c`。本 agent 未提交、未构建 Harmony Native/HAP、未操作设备、未联网访问用户书源；主任务已将第一批修复提交为 `7d1422ca3`，随后三项审读修正由主任务另行提交。Legado `6763d061bc92b2164ac274363a807e4ed4be34e2` 只读用于行为顺序比对，未复制或翻译 GPL 实现。

## 已实现的有限范围

1. `reader-content/src/lib.rs:3504`：按页提取 title/content/next，使用既有可变上下文规则适配器把该页变量传给下一字段、下一页及最终整章阶段。正文 HTML 规范化与整章替换分离。
2. `reader-content/src/lib.rs:3574`：复用完整规则引擎和既有模板适配器执行独立 `replaceRegex`。单页、分页共同终点只执行一次；`result` 为完整章节，`java.getString` 的默认分析对象为第一响应，book/chapter/输入 continuation 可用。模板 `{{result}}` 与 `{{java.getString(...)}}` 使用同一上下文。没有对字面反斜杠做全局解码。
3. `reader-runtime/src/remote.rs:9403`：先按页以 LF 合并、整章替换，再应用用户内容处理与展示投影。保留已有分页限制、取消、书源版本及缓存新旧时间保护。最终规则报错或正文为空时，不覆盖已有缓存。
4. 新 `reader-html` 共用既有 scraper 0.19.1 / html5ever 0.27.0；分别为 ISC 与 MIT/Apache-2.0（本机锁文件与 cargo registry 元数据已核对）。替换远程正文及 `java.htmlFormat` 的手写标签扫描和小型实体表；HTML5 解析、实体解码由上游承担，Reader 仅定义换行、屏蔽脚本样式、保留图片标记的业务策略。EPUB 生产代码未改。
5. 规范图片属性保留一层实体；最终替换后的正文实体解码复用既有图片 marker 扫描器跳过属性，投影时才对属性解码一次，避免 URL DSL 的 JSON header 引号截断。非空 pass-through JS 与 `##广告` 都有真实图片/标量区间回归。
6. standalone `chapter_content`、现有漫画单页语义分支、CLI 单页书源 fixture 均接同一最终处理方法，保持离线生产探针和 Runtime 顺序一致，没有新增另一套解析器。
7. HTTP 正文不消费 `sourceRegex`。确实需要 WebView 资源匹配的计划返回 `SOURCE_RESOURCE_INTERCEPTION_UNSUPPORTED`，不把 performance timeline 当成资源拦截。PH76 仍为能力缺口，没有新增 Host 拦截栈。

## 数据与合同

- SQLite schema 18→19：事务内仅增加 `chapter_cache.content_format_version INTEGER NOT NULL DEFAULT 0`；可重复迁移，原正文、时间、revision 保留。
- StorageSnapshot 12→13：旧字段默认 0，旧快照继续可导入；新快照使用现有版本门禁，旧 Core 不承诺读取新版本。
- 新远程抓取写入处理版本 1；旧缓存保留 0。所有缓存读写、条件覆盖、队列回滚、快照导入导出均携带版本。
- 缓存返回的 `contentFormatVersion` / `contentRefreshRequired` 为可选事实字段；后者只说明格式版本差异，绝不授权自动重取或覆盖正文与位置。正常读取旧缓存不执行提取或书源替换脚本，不产生 Host 请求。
- PH75：现有远程位置解析不能对正文变化安全迁移进度/书签/高亮。本轮不自动升级、清空或重解析旧缓存。用户现有章若已缓存异常文本，不能声称本轮会自动改好；需要后续完整位置事务保护后才可安全升级。
- 暂未改变最终替换 JS 写入变量向后续章节持久化的合同；本轮保证既有输入上下文及分页产生的变量可读取，不伪称任意 JS 副作用已做跨章持久化。

## 复现与回归记录

- 原始生产方法探针 `ph71-core/REPORT.md` / `results.jsonl`：12 例中 6 项明确旧缺陷、6 项排除性样本；规则统计只来自本机内置配置，不代表在线实测。
- `ph71-core/minglong-finalization-review-red.log`：最终审读补出的三项真实红——图片属性提前解码、模板第一响应/整章 result 缺失、standalone continuation 丢失。
- `ph71-core/minglong-finalization-review-green2.log`：最终 6/6 内容集成 PASS，覆盖上述三项与独立替换、合法转义、JSON/HTML 层、第一响应及 book/chapter 上下文。
- `ph71-core/minglong-workspace-nextest2.log`：3737/3738 PASS；唯一红是既有 v14 聚焦迁移 fixture 未包含真实 v13 必有的 v1 chapter_cache。已添加历史 SCHEMA_V1_DDL，保留读记录、author 和时间断言，未让生产迁移跳过缺表错误。
- 第一轮 `host_record_suite_outputs_replayable_comparison_fixture` 曾发生 `unknown host operationId: 1`；第二轮完整 workspace 该测试通过。保留日志 `ph71-core/minglong-workspace-nextest.log`，不把间歇失败当成已定位或用户书源故障。
- `ph71-core/minglong-workspace-clippy4.log`：最终 workspace/all-targets clippy `-D warnings` PASS。
- 严格 command contract drift PASS；新增字段已在 event schema 说明事实边界。
- 最终全量 nextest 与 conformance 结果由本文件后续追加精确值，当前不得借编译或本地回归宣称 VM/真机/用户验收完成。

## 仍不能归因的用户实例

不知道用户成功第二源的 ID/规则版本，也没有该次原始 HTTP / Core 正文；不能把通用修复宣布为它的唯一根因或真机已验证。三个内置 66 书吧变体的正文 replaceRegex/sourceRegex 都为空，本次正文缺陷也不能直接解释其目录解析失败。TOC、搜索预检、搜索结果复用和预览返回由主任务及其他 agent 分别处理。

## 最终审读补正与明确冻结

主任务要求的三项最终补正均已完成并停止 Core 写入：

1. 整章替换新生成的相对图片，进入投影与缓存前再次复用现有 URL 解析方法，基于第一响应 URL 补齐；原各页绝对图片地址保持幂等。
2. 整章模板表达式抛错、调用不支持能力或模板未闭合时，返回错误，不能把 `{{规则原文}}` 写入缓存。普通非最终阶段模板继续原有未知变量兼容语义。
3. 目录规则自动补全后若与原规则完全相同，不再执行相同规则作为空结果回退。使用仓库 `tests/fixtures/corpus/sources/src-669-d510a10eb1ba.json` 的完整规则与 jsLib（已逐字段核对等同 bundled1027）配 fake ajax 正式回归：缺少 data 时原本 2 次 callback，修后仅 1 次；有效空目录和正常目录也均保持 1 次。

新增正式回归 `crates/reader-content/tests/toc_rule_single_execution.rs`；没有只留临时探针。末端图片与模板两红日志 `ph71-core/minglong-terminal-review-red.log`；同场景修后 `ph71-core/minglong-terminal-review-green.log` 2/2 PASS。66 两次 callback 红日志 `ph71-core/minglong-toc-retry-red.log`。

最终源码门禁：

- `cargo test -p reader-content --locked --offline`：392 PASS、0 FAIL（19 test groups，含源码单测、fixture/integration 与空 doc-test group），日志 `ph71-core/minglong-content-final.log`。
- `cargo nextest run -p reader-runtime -p reader-cli --locked --offline --no-fail-fast --test-threads=1 -E 'test(pagination) | test(search_content_commands) | test(source_webview_plan_tests) | test(replace_persistence_failures_restore_persist_and_undo_before_images) | test(host_record_suite_outputs_replayable_comparison_fixture)'`：42 PASS、0 FAIL、1183 未选中；日志 `ph71-core/minglong-runtime-final-targeted.log`。
- workspace/all-targets clippy `-D warnings` PASS，日志 `ph71-core/minglong-final-clippy.log`；conformance 210/210 PASS，日志 `ph71-core/minglong-final-conformance.log`；fmt 与 diff check PASS。
- 最后一轮完整 workspace 是三项补正之前的版本：3740 项中 3739 PASS、1 FAIL。失败为 `runtime::tests::replace_persistence_failures_restore_persist_and_undo_before_images`，断言第 3 个事件应该是 operationId=2 的 PersistencePut（日志 `ph71-core/minglong-workspace-nextest3.log`）。该测试此前全量通过，后续最终源码的串行定向复核通过；未隐藏原失败、未修改该测试，也未宣称完整全量绿。
- 第一次全量出现的 host_record_suite `unknown operationId:1`，第二/第三次全量及最终串行定向均通过。仍属独立间歇事件时序观察，不借最终通过称根因已定位。

最终编译 CLI 的完整离线 replay：

- `ph71-core/ph68-66-exact-toc-replay.json` → `ph71-core/minglong-66-valid-after.log`：1 个 host.request，1 个终态 result，toc 长度 2。
- `ph71-core/ph68-66-missing-data.json` → `ph71-core/minglong-66-missing-data-after.log`：1 个 host.request，1 个终态 result，toc 长度 0。没有第二个同 URL 悬挂请求；HTTP 结果为合成数据，不代表该接口现网实际响应。
- 二进制身份 `ph71-core/minglong-final-cli-info.log` 与 `ph71-core/minglong-final-cli-sha256.txt`。这不是 Harmony Native/HAP 或真机证据。

本 agent 于最终冻结后只写本临时报告，不再修改 Core。最终待主任务补提交的文件为 `reader-content/src/lib.rs`、`reader-runtime/src/remote.rs`、`reader-runtime/tests/pagination.rs` 与 `reader-content/tests/toc_rule_single_execution.rs`。

主任务随后确认上述四个文件已提交为 `316ed8362`，并独占执行一次末版标准 `check-local.sh` 门禁（日志 `ph71-core/ph68-74-core-final-gate.log`），再决定 Native/HAP。该门禁结果由主任务记录，本 agent 未借用尚未结束的门禁宣称最终全量通过。


## 主任务最终标准门禁

提交 `316ed8362` 的标准 `check-local.sh` 已完整退出0：**3742/3742 workspace 测试、210/210 conformance、workspace/all-targets Clippy、格式、严格合同漂移、C 与 C++ ABI smoke全部通过**。本次是新的末版门禁，不抹去前面两次间歇失败或把其根因称为已解决。完整日志与SHA见 [最终Core回执](ph71-core/final-core-gate.json)。
