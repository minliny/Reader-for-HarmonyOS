# 当前书源新增后重新全量验证：前 80 章正文解析

本轮在用户反馈“书源已添加”后重新执行。输入仍以当前仓库 raw bundle 为准：`reader-tested-book-source-collection.json` 1046 条，SHA-256 `b2abb67815534e9d58efeb27025fc6be4336cbbc8dfb485904e8bb76c73f18`；仓库侧没有新增 raw source 文件或修改。全量搜索和正文深测均为 fresh live PC Reader Core/CLI，排除历史输入、没有复用上一轮结果，也没有修改应用启用状态或用户数据。

## 结论

- 当前搜索精确命中的小说 sourceId：**8 个**（另有 3 个信息类 sourceId，不计入正文书源）。
- 11 个当前精确命中的小说规则 fingerprint × 80 章：**880 次独立调用**。
- 严格完整解析 80/80：**0/8**。
- 本轮新增命中并纳入深测的 `https://www.biquge345.com/` 仅 11/80 章通过；其余 69 章返回搜索页/反爬页面。

## 八个小说 sourceId

| sourceId / 代表规则 | 结果 | 失败原因 |
|---|---:|---|
| `https://66shuba.com` / 66书吧 | **0/80** | 80 章正文均 HTTP 403/anti_bot。 |
| `https://bookshelf.html5.qq.com` / 松鹤阅读 | **77/80** | 第 78–80 章仅 50/47/50 字，带字面量 `...`；接口返回 ads read 不支持的截断片段。 |
| `https://bookshelf.html5.qq.com/` / QQ阅读01 | **77/80** | 第 78–80 章仅 50/47/50 字，带字面量 `...`；接口返回 ads read 不支持的截断片段。 |
| `https://m.qidian.com#ReaderTestBuiltin` / 起点中文 | **0/80** | 80 章目录阶段 HTTP 404/Core error。 |
| `https://novel.html5.qq.com` / 企鹅浏览 | **0/80** | 80 章目录阶段 `js_unsupported`。 |
| `https://so.html5.qq.com/` / QQ浏览器、企鹅浏览（优）、🔥QQ浏览器免费小说 | **0/80** | 规则变体在正文 401/Core error 或目录为空。 |
| `https://www.biquge345.com` / 笔趣阁345-完美版、笔趣阁345-最终修复 | **0/80** | 规则变体为 `source_rule_stale` 或 `search_form_only`。 |
| `https://www.biquge345.com/` / 笔趣阁 | **11/80** | 69 章为 `search_form_only`（搜索页/反爬响应），只有 11 章正文通过。 |

## 截断判定

正文完整要求每章 L2 search、L3 detail、L4 TOC、L5 content 全部通过，正文长度大于 50，并且首/中/尾片段存在。QQ 第 78 章实际响应为 HTTP 200，但 payload 表明广告阅读不支持，正文只有几十字和省略号；HTTP 200 不代表正文完整。

## 证据

- 本轮搜索结果：[search summary](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/.reader-local/diagnostics/current-source-audit-20261024-rerun-20261024T134533/search-results/summary.json)
- 本轮 880 次逐章结果：[chapter-results.csv](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/.reader-local/diagnostics/current-source-audit-20261024-rerun-20261024T134533/chapter-results.csv)
- 本轮按 sourceId/规则变体聚合：[summary.json](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/.reader-local/diagnostics/current-source-audit-20261024-rerun-20261024T134533/summary.json)
- 每章有界诊断：[results/](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/.reader-local/diagnostics/current-source-audit-20261024-rerun-20261024T134533/results/)

这是 PC Reader Core/CLI 的真实网络解析结果，不等同于 HarmonyOS 真机 WebView/登录态验收；但足以确认当前仓库输入下，没有一个小说 sourceId 能无截断完成前 80 章。
