# 当前 source bundle 深度解析 80 章审计：还不起学贷的我只好兼职猎魔

本轮只使用当前 `reader-tested-book-source-collection.json`，不读取历史集合、不复用历史 receipt、不修改应用启用状态或用户数据库。搜索阶段已确认 7 个当前小说 sourceId；本轮为每个 sourceId 选择当前 raw 中实际精确命中的规则版本，逐章执行第 1–80 章 `search → detail → TOC → content`。

## 结论

- 严格完整解析 80/80：**0/7**。
- `https://bookshelf.html5.qq.com/`（QQ阅读01）和 `https://bookshelf.html5.qq.com`（松鹤阅读）各通过 77/80；第 78、79、80 章均不是完整正文，不能计入。
- 其余 5 个 sourceId 在目录或正文阶段即失败，没有完成 80 章正文读取。

## 七个 sourceId 的 80 章结果

| sourceId / 当前规则 | 状态 | 80 章明细 | 原因 |
|---|---|---:|---|
| `https://so.html5.qq.com/` / 企鹅浏览（优） | **0/80，失败** | 0/80 正文通过；0/80 全链路通过 | L5 正文请求 HTTP 401（`chapter.content`），没有正文。 |
| `https://novel.html5.qq.com` / 企鹅浏览 | **0/80，失败** | 0/80 正文通过；0/80 全链路通过 | L4 目录规则触发 `js_unsupported`，后续正文跳过。 |
| `https://www.biquge345.com` / 笔趣阁345-最终修复 | **0/80，失败** | 0/80 正文通过；0/80 全链路通过 | L4 目录触发 `source_rule_stale`，当前规则与站点目录响应不匹配。 |
| `https://66shuba.com` / 66书吧-起点 | **0/80，失败** | 0/80 正文通过；0/80 全链路通过 | L5 正文请求被 66shuba HTTP 403/anti_bot 拒绝。 |
| `https://bookshelf.html5.qq.com/` / QQ阅读01 | **77/80，失败** | 77/80 正文通过；77/80 全链路通过 | 第 78–80 章正文仅 50/47/50 字，返回内容带字面量 `...`；记录为 `text_content_too_short`，确认是接口付费/广告阅读拒绝后的截断片段。 |
| `https://bookshelf.html5.qq.com` / 松鹤阅读 | **77/80，失败** | 77/80 正文通过；77/80 全链路通过 | 第 78–80 章正文仅 50/47/50 字，返回内容带字面量 `...`；记录为 `text_content_too_short`，确认是接口付费/广告阅读拒绝后的截断片段。 |
| `https://m.qidian.com#ReaderTestBuiltin` / 起点中文 | **0/80，失败** | 0/80 正文通过；0/80 全链路通过 | L4 目录请求 HTTP 404，后续正文跳过。 |

## 截断证据

QQ 两个规则的第 78 章原始响应为 HTTP 200，但 payload 明确返回：`ads read is not supported, ads status 0, ret:2`，`Content` 只有：`原本昏暗无光的大海，此时忽然为金色天光贯穿。光芒从不可知的高处坠落，化为无数纱线，刺入每片海...`。第 79、80 章同样只有几十字。HTTP 200 不能当作正文完整；这正是“几段话后被截断”的情况。

## 规则变体复核

当前搜索精确命中的小说规则记录共 15 条（去重后 11 个 rule fingerprint）。补充审计对这 11 个 fingerprint × 80 章执行了 880 次独立 fresh `reader-cli` L1–L5，仍为 0/7 sourceId 完整通过。重复 sourceId 的其他规则没有出现可替代的完整链路：QQ 搜索变体在 L5 为 401 或目录为空，novel.html5 变体为 `js_unsupported`，笔趣阁变体为 `source_rule_stale`/`search_form_only`，66shuba 变体统一为正文 403/anti_bot。

## 判定标准

- 每章的 L2 search、L3 detail、L4 TOC、L5 content 均为 `pass`。
- 正文 `normalizedLength` 必须大于 50，且保留首/中/尾片段；≤50 或首中尾完全相同的片段按截断/短正文处理。
- 80 章必须全部满足，不能用前 77 章通过替代 80/80。

## 证据

- 80 章逐章结果：`Reader-for-HarmonyOS/.reader-local/diagnostics/current-source-audit-20261024/deep-80-20261024T123836/chapter-results.csv`
- 80 章聚合：`Reader-for-HarmonyOS/.reader-local/diagnostics/current-source-audit-20261024/deep-80-20261024T123836/summary.json`
- 每章有界诊断 JSON：`Reader-for-HarmonyOS/.reader-local/diagnostics/current-source-audit-20261024/deep-80-20261024T123836/results/`
- 当前精确规则变体首章烟测：`Reader-for-HarmonyOS/.reader-local/diagnostics/current-source-audit-20261024/deep-80-20261024T123836/variant-smoke.json`
- 11 个去重规则 fingerprint 的 880 次全章节补充审计：`Reader-for-HarmonyOS/.reader-local/diagnostics/current-source-audit-20261024/chapter80-results/report.json`

本轮是 PC Reader Core/CLI 的真实网络解析证据，不等同于 HarmonyOS 真机 WebView/登录态验收；但它已经足以证明当前 7 个 sourceId 中没有一个能在无截断条件下完成前 80 章。
