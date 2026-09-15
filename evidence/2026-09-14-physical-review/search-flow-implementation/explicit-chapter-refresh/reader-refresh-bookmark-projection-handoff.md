# 刷新正文后的书签显示与跳转审计/最小修复

本 agent 仅修改并冻结以下 5 文件，未提交、未修改 LRE/Index、未操作设备：
- entry/src/main/ets/features/reading/ReaderDirectoryDataSnapshot.ts
- entry/src/main/ets/features/reading/ReaderBookmarkProjection.ts
- tools/test-reader-directory-data-snapshot.mjs
- tools/test-reader-bookmark-projection.mjs
- tools/test-reader-control-bookmark-content.mjs

## 已修复

1. FullDirectoryPanel 在 aboutToAppear:213、onEntriesChanged:890–897、flushDeferredMutations:967–983 使用 ReaderDirectoryDataSnapshot 副本，并由 rebuildProjection:1243–1248 真正绘制该副本。旧副本丢 bookText/positionScope，且相等判断遗漏二者；不是只有诊断副本缺字段，会直接丢原摘录/跳转 proof，并忽略 scope-only 更新。现在完整复制 bookText 与五元组 scope，逐字段比较；scope 独立复制防原地变更逃过比较。
2. ReaderBookmarkProjection 增加可选 row.positionStatus='confirmed'|'unverified'，不更改 identityStatus。known local 沿用位置；known remote 的 scope 缺失或 sourceId/bookId/chapterIndex 不符时为 unverified，位置文案“位置待恢复”，不拿新正文长度计算百分比。匹配 scope 采用 Core 已验证当前缓存 proof；未知所有者不虚构位置确认或百分比。
3. 原 bookText/content/章节/ID/偏移/scope 原值均保留。excerpt 仍仅来自保存的 bookText，空时用保存的 content，绝不以旧偏移截新正文。ReaderBookmarkRow 原有位置文本及 accessibility 渲染可直接显示新文案，无需新 UI 或 props；点击携带原 proof/offset，由 LRE 完成准入。
4. 未引入 current-scope map 或跨层 props。根任务负责 LRE 当前章五元组过滤、committed 后重读 Core bookmark projection；Core 的 bookmark_scope 只返回和当前 cache 相符的 scope。

## 根任务负责的确定风险

- LRE 旧 currentPageBookmarkStatus:10566–10582、toggleCurrentPageBookmark:10670–10676 仅以offset落页判断，不验scope；可能错误亮页角且从新正文手势误删旧书签。
- 页角缓存/反馈 anchor:10570/10588 不含 bodyVersion/processingVersion，正文换版但页边界相同可复用旧状态。
- 热态 selectBookmarkAnchor:9374–9384 对缺 scope 的远程非零书签已 toast 并保持原位置；冷开 Index:3664 先 openReading，LRE:2983–2985 同情形抛错经 fail 进入整页错误。建议冷开在路由切换前采用同样准入提示，不能把原偏移伪装成新 scope。
- 已有 scoped 跳转不是无保护：LRE positionContextForScope:9452–9459 校验身份并携旧版本；loadSessionChapter:3285–3289 在版本不同时绕过章窗口；RemoteReadingPositionMigration.ts:94–124 要求匹配 receipt 及完整 anchor 集。因此没有证据称这条现有路径直接拿旧 scoped offset 画新正文。

## 持久化划线/正文高亮边界

对 Harmony entry/src 的 annotation/highlight.list/highlight.create/underline/划线/批注调用审计，没有持久化划线的读取/显示/点击消费者。当前 ReadingSurface.ets:98–101 的输入是 ttsHighlightStart/End 与 autoPageHighlightStart/End；LRE:1665–1668、1706–1709 供给 TTS/自动翻页动态范围，自动翻页范围从当前 visibleFragments 取值（2538–2556）。不能宣称已完成持久化划线 UI，也没有当前生产消费者会直接把保留的旧划线偏移画进新正文。本轮未扩展该未接入能力；旧划线保存与迁移属于 Core owner。

## 实际回归

- 修前：node tools/test-reader-directory-data-snapshot.mjs 明确失败于原摘录丢失。/private/tmp/reader-bookmark-refresh-snapshot-before.log
- 修后同脚本 PASS：完整 scope/原文复制、五个字段独立更新、proof撤回、excerpt-only 与原地更新；真实 FullDirectoryPanel onEntriesChanged/flushDeferredMutations/rebuildProjection 在动画中保持树、终点更新scope/文案/摘录且保留滚动位置。/private/tmp/reader-bookmark-refresh-snapshot-after.log
- node tools/test-reader-bookmark-projection.mjs PASS：unverified、scope身份不符、local、未知所有者、迁移record路径、原始数据不变。/private/tmp/reader-bookmark-refresh-projection.log
- node tools/test-reader-control-bookmark-content.mjs PASS：实际 quick/full Row Builder 显示旧quote与“位置待恢复”，无错误所有者badge，保留card回调更新后带最新proof。/private/tmp/reader-bookmark-refresh-builders.log
- node tools/test-reader-control-directory-model.mjs PASS。/private/tmp/reader-bookmark-refresh-directory-model.log
- node tools/test-reader-bookmark-panels.mjs PASS。/private/tmp/reader-bookmark-refresh-panels.log
- git diff --check PASS。

以上是源码与本地 SDK 生产方法/Builder证据，不是新包 ArkTS 构建或 VM/设备验收。
