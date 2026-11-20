# 搜索简介漏出 HTML 高亮标签

用户在消息样式接入包上反馈：搜索结果简介显示大量 `<font color=…>`；建议以“斗破苍穹”搜索观察。已安装产物为 `20261023T155303Z-6b1bd753-be3ba859`，HarmonyOS 源码 `6b1bd7534b61a8ebfac10150fd308eae8430606e` + dirty WIP，Core `9131ddcfeef1922620c6867f88fe82608e51a079`。本项实际设备修复验收尚未完成。

## 代码定位与已有证据

- `SearchPage.SearchResultCard.displayIntro()` 与书籍详情都调用 `BookIntroText.bookIntroText`。Host 仅折叠空白，依赖 Core 提供展示用纯文本。
- Core `normalize_display_intro` 的独立 HTML 识别名单遗漏 `font`。只有 `<font>` 高亮、没有其他已登记标签的简介被当成纯文本，标签原样穿透；不是 ArkUI 文本换行或字体的问题。
- `book.search`、`book.detail`、缓存 `search-book.*` 和书架响应都已调用该展示投影；原始简介保留在 Core 存储中，可能继续被书源规则使用。
- 本地既有原始 UI 证据 `.reader-artifacts/evidence/worktree-audit-20261014/vm-full-integration/reader-control-int-search-results.json` 已包含“三体”简介的连续 `<font color='#ff4242'>三体</font>`，与此次反馈属于同一漏识别路径。没有将该旧样本冒充本次“斗破苍穹”实源结果。
- 随后在主机侧执行现有 `src-003-752f07e02faf.json` 的搜索 URL 规则，以“斗破苍穹”查询“阅读助手（优+++）”：HTTP 200，10 条结果中 5 条简介含原始 `<font color='#ff4242'>斗破苍穹</font>`。本次原始简介与书名保存在根 `.reader-artifacts/search-intro-markup-20261024/live-query.json`。这些样本没有实体转义的 font 或未闭合的尾部标签；实际简介片段已加入生产函数测试。此为主机 HTTP/规则输入证据，没有操作真机或声称 UI 已验收。
- 现有 `reader-html::fragment_text` 已使用固定版本 `scraper 0.26.0` / html5ever，并识别 `font`。复用该实现，删除简介侧重复标签名单和树遍历；保留简介既有实体解码、双向文字及段落策略，不新增 HTML 解析器，不修改原书源数据。
- 本次保留合法 `a < b`、`<T>` 以及未完成的 `<font color` 字面文本。实体转义的代码（如 `&lt;font…&gt;`）仍按原有约定显示为文字，不做第二次 HTML 解析；没有把这些未出现在本次实源中的情况粗暴吞掉。

## 本次限定验证

入口为 Core `node scripts/check-local.mjs --stages workspace-tests --select 'workspace-tests:<准确选择器>' --rationale ...`。仅内嵌 `cargo test --locked -p <包> --lib <测试全名> -- --exact --nocapture`，没有 full、额外阶段、HAP 或设备操作。

1. `reader-content#lib#normalization::tests::display_intro_removes_font_highlights_and_inert_markup`：复现独立 font 高亮漏出，并检查真实旧样本形式、大小写/属性、仅图片或不可见标签；必要性为确认此次直接根因。
2. `reader-content#lib#normalization::tests::display_intro_uses_standard_entities_without_rewriting_literal_or_language_text`：保留原有实体、合法 `<` / 泛型文本、转义代码、段落和 RTL/emoji 行为；必要性为共享投影替换不能误删真实简介文字。
3. `reader-runtime#lib#remote::source_fetch_and_catalog_tests::display_intro_projection_does_not_rewrite_stored_source_books`：实际搜索、详情与缓存展示返回纯文本，底层存储原文保持不变；必要性为修复不能破坏后续依赖原简介的书源规则。

## 本地结果

- 修复前精准 font 用例 FAIL，实际结果为完整 `<font color='#ff4242'>斗破苍穹</font>` 泄出；回执 `Reader-Core/.reader-artifacts/gates/1792771506462-8b5dcfb0-2724-4108-a81c-fd5cc5037a66/receipt.json`。
- 修复后、加入当前实源片段的精准 font/嵌套段落/不可见内容用例 PASS（1/1），回执 `Reader-Core/.reader-artifacts/gates/1792771789513-f98f051a-0fbb-4459-acdd-9ac213090e20/receipt.json`。
- 合法文字、实体、转义代码、RTL/emoji 兼容用例 PASS（1/1），回执 `Reader-Core/.reader-artifacts/gates/1792771665567-4734bf48-695f-4247-a34f-bb0b9c698fec/receipt.json`。
- 实际运行时 DTO 与存储保护首次扩展用例 FAIL：原有测试使用 inline source，仅发布 `source_books`，新增 `search-book.get` 对未创建的缓存返回空；搜索展示和 `source_books` 原文断言已通过。回执 `Reader-Core/.reader-artifacts/gates/1792771800171-681c86ce-85b7-45ac-ae52-2eb4592e6c41/receipt.json`。修正准备为通过现有 `search-book.put` 建立旧缓存，再核对 `get` 和底层原文，不修改生产缓存策略。
- 最终实际运行时 DTO/旧缓存/原文保护单例 PASS（1/1），回执 `Reader-Core/.reader-artifacts/gates/1792772548269-8b7caba8-65c6-4ca2-8a49-1b7c8dcd93b8/receipt.json`。搜索、详情、缓存返回干净简介，原简介留在各自存储中。
- 精准测试启动曾被其他连续 NAPI/HAP 构建占锁拒绝，未执行测试、未抢占或终止其他构建；等交付释放后完成上述指定验证。第三方 `kamadak-exif` 原有生命周期标注警告仍存在，与简介逻辑无关，不因此扩大测试或修改依赖。
- 本项未运行全量、未构建 HAP、未操作设备。静态定位、本地验证、HAP、设备与用户验收分开记录。
