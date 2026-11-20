# 新增 2520 书源全量搜索与 80 章深测结果

本轮使用另一对话生成的 `book_sources_20261024/book_sources_dedup.json` 作为唯一输入。该集合由 9868 条抓取记录去重为 2520 条，去重移除 7348 条，来自 2 个站点的 16 个成功源组；没有使用 Reader 当前 raw bundle 的 1046 条，也没有使用历史结果或旧 receipt。

## 结论

- 全量搜索：2520/2520 条完成；精确命中 57 个规则版本，其中 56 个小说 sourceId。
- 80 章深测：56 个小说规则 × 80 章，共 4480 次独立 `search → detail → TOC → content`。
- 严格完整解析 80/80：**25/56**。
- 另外 3 个规则虽然 L5 80/80，但正文指纹重复，已按异常重复内容剔除；2 个规则为 77/80 且第 78–80 章截断。

## 通过 80/80 的 25 个 sourceId

- `http://api.lfdapengu.com`：猫眼看书（优++）
- `http://m.rulianshi.la`：不知加啥
- `http://www.23uswx.la`：顶点小说⑤
- `http://www.aixiashu.net`：爱下书小说网
- `http://www.badaoge.org`：笔尖中文
- `http://www.biqusa.com`：毕曲萨阅读
- `http://www.botaodz.com/`：快眼看书botaodz
- `http://www.kenshuwx.com`：🎉 啃书阁
- `http://www.kk169.net/`：穿越小说
- `http://www.qudushu.com/`：去读书
- `http://www.qudushu.org/`：去读书
- `http://www.rulianshi.org/#pb1101`：殓师灵异（优）
- `http://www.shukuge.com/`：365小说网
- `http://www.swsk.org`：35小说
- `http://www.weilaitianwang.com/`：💦未来天王
- `http://www.x23us.us#🎃`：🎃顶点小说🎃#2
- `http://www.xbotaodz.com`：快眼看书（优+）
- `http://www.xyusk.com`：🔖优四小说网
- `http://www.yetianlian.cc#`：夜天连看
- `http://www.yetianlian.com`：🔰 夜天连看
- `http://www.yetianlian.la`：🎉 夜天连看
- `http://www.yingsx.com/#`：🎉笔趣阁A18
- `https://www.aixiawx.com/`：💯爱下书小说网
- `https://www.aixiaxsw.com`：爱下书小说网
- `https://www.biqusa.com/#`：笔趣阁A17

## 未通过的 31 个 sourceId

| sourceId | L5 通过 | 主要原因 |
|---|---:|---|
| `DragonQuestQBkd1` | 77/80 | text_content_too_short=3 |
| `http://23.225.143.232` | 0/80 | core_error=80 |
| `http://api.jmlldsc.com/` | 0/80 | anti_bot=80 |
| `http://api.lemiyigou.com` | 0/80 | anti_bot=80 |
| `http://api.xingliangglobal.com#` | 0/80 | core_error=80 |
| `http://m.badaoge.org#🎃` | 80/80 | 重复正文指纹；重复指纹 5 组 |
| `http://m.kk169.com` | 0/80 | core_error=80 |
| `http://m.kk169.net#` | 0/80 | core_error=80 |
| `http://m.qudushu.com#🎃` | 0/80 | anti_bot=80 |
| `http://m.qudushu.org` | 0/80 | core_error=80 |
| `http://m.xvipxs.net` | 80/80 | 重复正文指纹；重复指纹 5 组 |
| `http://wap.shukuge.com` | 80/80 | 重复正文指纹；重复指纹 5 组 |
| `http://wap.wangshugu.info` | 0/80 | core_error=80 |
| `http://www.4xiaoshuo.info#🎃` | 0/80 | core_error=80 |
| `http://www.aixiawx.com/` | 0/80 | url_construction_error=80 |
| `http://www.balingtxt.com` | 0/80 | network_unreachable=80 |
| `http://www.xqishuta.com` | 10/80 | core_error=70 |
| `http://www.yetianlian.info` | 12/80 | core_error=68 |
| `http://www.yetianlian.net` | 12/80 | core_error=68 |
| `https://66shuba.com` | 0/80 | anti_bot=80 |
| `https://m.zhongtianwen.cn` | 0/80 | toc_result_parse_gap=31; core_error=49 |
| `https://novel.html5.qq.com/` | 0/80 | js_unsupported=80 |
| `https://so.html5.qq.com/` | 0/80 | core_error=80 |
| `https://wap.yingsx.com/` | 0/80 | core_error=80 |
| `https://www.biquge345.com` | 10/80 | search_form_only=62; core_error=8 |
| `https://www.biquge365.net#🎃` | 8/80 | search_form_only=72 |
| `https://www.dingdian888.com/` | 11/80 | search_form_only=69 |
| `https://zhongtianwen.cn` | 0/80 | source_rule_stale=40; core_error=40 |
| `novel.html5.qq.com` | 0/80 | core_error=80 |
| `去789` | 0/80 | core_error=80 |
| `🐧` | 77/80 | text_content_too_short=3 |

## 判定标准

- 每章 L2 search、L3 detail、L4 TOC、L5 content 均通过。
- 正文长度大于 50，且保留首/中/尾片段。
- 不能存在重复正文指纹；否则视为同一章内容被复用或规则返回固定片段。
- 80 章必须全部满足，搜索命中或单章通过不能替代 80/80。

## 输入与证据

- 去重集合：`book_sources_20261024/book_sources_dedup.json`，SHA-256 `1b681349d1b122aca286810bbda75d6933c73109f43ca0084a574554250e902c`
- 去重清单：`book_sources_20261024/book_sources_dedup_manifest.json`，SHA-256 `a09f2a81062021720ed7b10d857375b7ded78543eade4eb74e7b88a5597b7566`
- 搜索汇总：[search summary](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/.reader-local/diagnostics/book-sources-2520-audit-20261024T135758/search-results/summary.json)
- 80 章聚合：[summary.json](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/.reader-local/diagnostics/book-sources-2520-audit-20261024T135758/summary.json)
- 逐章结果：[chapter-results.csv](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/.reader-local/diagnostics/book-sources-2520-audit-20261024T135758/chapter-results.csv)
- 每章诊断：[results/](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/.reader-local/diagnostics/book-sources-2520-audit-20261024T135758/results/)

本轮是 PC Reader Core/CLI 的真实网络解析证据，不等同于 HarmonyOS 真机 WebView/登录态验收；但已经完成了新增 2520 书源集合的搜索和命中源 80 章正文验证。
