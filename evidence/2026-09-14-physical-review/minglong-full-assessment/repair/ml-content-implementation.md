# ML04/05/06/07 与代理失败记账修复交接

代码已冻结，不提交、不构建 Native、不操作设备。

## 改动
- reader-rule：增加 required JS 错误传播和 Chapter 读取模式，正文末端按原 JSON/JS 类型只接收字符串或扁平字符串段落数组；结构化 JS 中间结果继续可被后续 JSONPath 读取。可选字段保留容错，正文字符串不重新按 JSON 解析、不全局删除反斜杠/括号/null。
- reader-content：必需搜索 bookList、目录 chapterList 和正文启用对应政策；严格模板路径只在所有等价选择器均失败时传播错误。必要脚本和HTTP均单次执行。
- 66：固定完整原规则精确匹配，原脚本一次执行后验证 response.data.content。错误 message、catch java.log、对象/null不作为正文；字符串数组投影为段落，空串送既有empty门禁。没有改变 java.log 全局语义、源数据、凭据、URL，也没有复制Legado实现。
- Runtime：chapter.content 的提取/分页/收尾错误附 SOURCE_RULE_FAILED 或 SOURCE_RESPONSE_FORMAT + stage；失败不写坏缓存。普通缓存读与 format2/PH75保护保持原样。
- Runtime代理：content_internal调用ph76 agent提供的 preserve_js_host_error；TOC/正文不覆盖 NETWORK_ENVIRONMENT；source-check 和换源环境失败短路，不逐源判坏/空耗。缓存下载保留专用失败收尾，避免Running残留且不更改源健康。
- Harmony：commandFailed根据结构category还原解析/空内容/空目录，NETWORK_ENVIRONMENT属非SOURCE类且显示networkFailed，不建议换源或提交健康惩罚。

## 文件
Core crates/reader-rule/src/lib.rs
Core crates/reader-content/src/lib.rs
Core crates/reader-content/src/source_adapters.rs
Core crates/reader-content/src/source_adapters/66-chapter-original.js
Core crates/reader-content/tests/chapter_typed_admission.rs
Core crates/reader-content/tests/toc_rule_single_execution.rs
Core crates/reader-runtime/src/remote.rs
Harmony entry/src/main/ets/features/reading/RemoteContentAdmission.ts
Harmony tools/test-remote-content-admission.mjs

## 验证
- /private/tmp/ml-content-regression-final.log：reader-content+reader-rule 829项通过，0失败0忽略。
- 最后模板等价选择器fallback微调后 /private/tmp/ml-content-after-review.log：reader-content 400项通过，0失败0忽略；reader-rule未变，原429项继续有效。
- 新 chapter_typed_admission 初始4个正式测试内33个场景（后续补齐导航分支后为5个正式测试）；原66 TOC 3种回包全部断言只调用HTTP一次，missing data明确JsExecution而合法空数组仍0章；适配器测试逐字核对原fixture。
- /private/tmp/ml-runtime-admission-final.log：2项通过（非法正文不替换现有缓存、两个真实批处理continuation遇环境失败停止且全库snapshot不变）。
- /private/tmp/ml-position-preservation.log：22项PH75/格式2/位置迁移保护通过。
- /private/tmp/ml-content-clippy-final.log：reader-content/reader-rule all-targets clippy -D warnings通过。
- Harmony node --experimental-strip-types tools/test-remote-content-admission.mjs 通过。
- owned diff --check通过。

## 边界
实际鸣龙章节的HTTP样本尚未取得；这些是完整原规则+合成Host回包生产链复现，不是线上各源可读率或真机验收。显式JS返回的普通文字不能靠词语/JSON外观猜成错误，这次拒绝依赖结构类型或已确定的66接口envelope，不声称识别所有上游伪文本。旧错误缓存遵守普通读取只读、显式单章保护刷新；不清缓存/不迁移偏移。

## 后续补齐
- 显式配置的TOC chapterUrl是必需导航字段：JS抛错传播，成功空串仍保留卷名。新正式测试覆盖两种情况；最终reader-content401项通过（/private/tmp/ml-navigation-required-final.log）。
- 首次官方check-local退出0，3852断言通过0跳过，但1个CLI host_replay LEAK，不能记零泄漏通过；conformance210/0、drift0、C/C++ smoke通过，原日志完整保留 /private/tmp/ml-core-check-local-final.log。
- CLI正常路径当前已有child.wait_with_output及watcher.join，代码未发现漏回收同一分支；独立20轮该测试无LEAK，不能证明全量偶发已修。没有盲改超时/隐藏stdio。全量最终版已完成，结果见下。

## 最终官方门禁（冻结源码）
- /private/tmp/ml-core-check-local-final-v2.log：check-local退出0；fmt、全工作区clippy通过；3853项通过、0跳过、本轮无LEAK；conformance210通过0失败；drift无结构差异/发布阻塞；C与C++ ABI smoke均通过。
- 首轮CLI偶发LEAK依然保留为历史未定位事件，20轮单项复测与最终全量均未复现，不声称已修复其根因；未改CLI源码。
- parent已提交：7c5c1f41c（runtime/bridge）、ab51123a2（content/rule）。当前Core工作区干净，生产源码冻结后未再修改。
