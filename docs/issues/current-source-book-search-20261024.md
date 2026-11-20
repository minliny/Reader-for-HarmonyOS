# 当前 source bundle 全量重测：本书搜索解析

用户要求重新执行全量测试，明确排除历史记录。本轮只读取当前 `reader-tested-book-source-collection.json`，不读取 2026-09-27 历史导入集合，不复用上一轮 receipt，也不修改应用启用状态或用户数据库。

## 执行范围

- 当前 raw source bundle：1046 条输入记录。
- 去重身份：919 个 `sourceId`；当前 raw 中包含 preferred 规则及 127 条 nonpreferred 当前文件记录。
- 实际任务：1046 条；全部重新执行，没有复用任务。
- 每条任务：独立临时 SQLite、独立进程和 Cookie session，8 路并发，搜索页第 1 页，单源最多 30 秒，HTTP 单次尝试。
- 关键词：`还不起学贷的我只好兼职猎魔`；作者准入：`小夕岁`。
- 只测 `source.import → source.list → book.search`；详情、目录、正文未执行。

## 结果

物理任务结果共 1046 条：

| 结果 | 任务数 |
|---|---:|
| 精确书名和作者通过 | 19 |
| 返回其他书名 | 113 |
| 空结果 | 326 |
| HTTP 失败 | 279 |
| 传输失败 | 106 |
| 规则 / runtime 失败 | 188 |
| 同名但作者缺失 | 3 |
| 同名但作者冲突 | 1 |
| 超时 | 11 |
| **合计** | **1046** |

按 `sourceId` 去重后，精确命中 10 个身份，其中 7 个是小说源、3 个是其他类型的信息源；规则版本共 19 个。

当前小说源中：

- **当前启用并精确解析：3 个**：松鹤阅读、QQ阅读01、起点中文。
- 当前停用但精确解析：4 个：66书吧、QQ浏览器/企鹅浏览器两类 sourceId、笔趣阁345旧规则身份。
- 当前启用的笔趣阁 `https://www.biquge345.com/` 本轮返回空结果，没有计入可解析数。

因此本轮当前应用口径是 **3 个启用书源可以解析这本书**。这次与上轮不同，是因为笔趣阁当前启用规则本轮实际返回空结果；不能沿用旧结果中的 4 个。

## 边界

“精确解析”表示当前 Core 的搜索 decoder 返回书名，并通过生产作者身份准入；不表示详情页、目录或正文一定可读。停用源只在隔离临时输入中测试，未打开应用开关。

本轮没有使用历史 556 条规则、没有复用旧 receipt、没有 HDC、没有构建或修改生产源码。

证据目录：

- `../../.reader-local/diagnostics/current-source-audit-20261024/search-results/`
- [当前 1046 条逐项明细](../../.reader-local/diagnostics/current-source-audit-20261024/search-results/current-1046-inputs.csv)
- [任务结果](../../.reader-local/diagnostics/current-source-audit-20261024/search-results/task-results.csv)
- [sourceId 汇总](../../.reader-local/diagnostics/current-source-audit-20261024/search-results/source-identities.csv)
- [manifest](../../.reader-local/diagnostics/current-source-audit-20261024/search-results/manifest.json)

结果状态：`COMPLETE_WITH_FAILURES`；不是“全部书源通过”。
