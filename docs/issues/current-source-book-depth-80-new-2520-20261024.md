# 新增 2520 去重书源：前 80 章完整解析复测

输入集合：`book_sources_20261024/book_sources_dedup.json`，SHA-256 `1b681349d1b122aca286810bbda75d6933c73109f43ca0084a574554250e902c`。该集合来自 9868 条抓取记录，去重后 2520 条；本轮未使用历史记录或旧结果。

- 全量搜索：2520/2520 条。
- 精确命中本书的小说规则/sourceId：56 个。
- 深测：56 × 80 = 4480 次独立 `search → detail → TOC → content`。
- 严格完整解析 80/80：**25/56**。

## 通过 80 章的 sourceId

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

## 典型失败/截断

- DragonQuestQBkd1 与 🐧：77/80，第 78–80 章正文短且带省略号。
- 66shuba、猫眼部分源：正文 HTTP 403/anti-bot。
- QQ/企鹅源：目录或正文 401、JS 不支持。
- 笔趣阁部分规则：`search_form_only`、`source_rule_stale`。
- 3 个规则虽 80/80 返回正文，但每 25 章出现重复正文哈希（章节映射错位），因此不计入完整通过：`m.badaoge.org#🎃`、`wap.shukuge.com`、`m.xvipxs.net`。

## 证据

- [搜索汇总](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/.reader-local/diagnostics/book-sources-2520-audit-20261024T135758/search-results/summary.json)
- [80 章汇总](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/.reader-local/diagnostics/book-sources-2520-audit-20261024T135758/summary.json)
- [逐章 CSV](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/.reader-local/diagnostics/book-sources-2520-audit-20261024T135758/chapter-results.csv)
- [逐章诊断](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/.reader-local/diagnostics/book-sources-2520-audit-20261024T135758/results/)
