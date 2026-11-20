# 本书在 PC 上按真实项目规则逐源搜索

本次用户要求实测《还不起学贷的我只好兼职猎魔》，作者“小夕岁”，在当前项目规则下到底能搜索到多少来源。实测时间为北京时间 2026-10-24 03:24:58 至 03:25:25；只搜索第一页，与阅读页换源 `book.search { sourceId, keyword, page: 1 }` 一致。没有查询详情、目录或正文，没有修改生产源码、手机、真实用户数据库或书源启用状态。

## 结论与计数单位

当前内置启用小说规则 **101 个 sourceId 全部执行完成**。精确书名和作者都通过生产 Gateway 准入的来源为 **4 个 sourceId**，按 URL hostname 去重为 **3 个站点**。松鹤与 QQ阅读01 的 sourceId 只差尾斜杠，但规则版本不同，按产品现有身份规则分别计算。

| 来源 | sourceId | 精确匹配条数 | 实际搜索耗时 | HTTP |
| --- | --- | ---: | ---: | --- |
| 松鹤阅读 | `https://bookshelf.html5.qq.com` | 1 | 870 ms | 200 |
| QQ阅读01 | `https://bookshelf.html5.qq.com/` | 1 | 926 ms | 200 |
| 笔趣阁 | `https://www.biquge345.com/` | 1 | 2176 ms | 200 |
| 起点中文 | `https://m.qidian.com#ReaderTestBuiltin` | 1 | 918 ms | 200 |

四条精确结果的原始作者均为“小夕岁”；没有通过去掉实质作者字符、模糊书名或放宽作者缺失规则来扩大数量。实际书籍地址分别对应 QQ `bookid=1159836844`、笔趣阁 `/book/185542/`、起点 `/book/1049836819`。

**阅读页窗口实际显示的是替代书源数。** `SourceSwitchGateway.ts:913–917` 按完整 `sourceId + bookId` 将当前绑定标为 `isCurrent`，保留在 Gateway 结果中；Host `discover` 保留该结果；`SourceSwitchWindow.ets:333` 将当前绑定从可选列表过滤，`:471`、`:740` 对可见列表按 sourceId 计数。因此，本次四源中以松鹤返回的同一身份为当前绑定时，窗口应显示 **3 个替代书源**（QQ阅读01、笔趣阁、起点中文）。这与手机观察到的“三候选”可以一致。

此前受控 Host 回归确实复现并修复了“七条 live seed 在后续投影变三条”的独立缺陷；它不是此次网络实测，不能证明手机当时实际漏掉四个在线来源。旧版本七个 sourceId、手机已安装/导入/修改的规则和本次手机当前绑定 bookId 都没有取得，不能以本次结果替代旧版本对照或宣称现场唯一根因。

## 全部结果分类

| 分类 | sourceId 数 | 解释 |
| --- | ---: | --- |
| 精确书名及作者匹配 | 4 | 生产 decoder 与 `admitsCandidate` 均通过 |
| 同名但缺作者 | 1 | 百度知道规则由请求关键词合成名称，见下文；不算实际发现本书 |
| 同名作者冲突 | 0 | 没有放松匹配 |
| 返回其他书名 | 34 | 有解析结果，但没有本书的精确书名；不能称为请求失败 |
| 空结果 | 43 | Core 正常返回零条；不能统一称为网络或规则失败 |
| HTTP 失败 | 6 | 404 四个、403 一个、521 一个 |
| 传输失败 | 7 | CLI adapter 记录 TLS 类错误；没有强行忽略证书错误 |
| 规则或 runtime / Host 准入失败 | 6 | 三个无搜索入口；抖音小说返回 HTTP 200 后 Core 错误；八叉书库 JS 不支持；猩猩小说 61 条全部未通过生产 Host decoder |
| 超时 | 0 | 单源搜索整体上限 30 秒 |

共解析 945 条结果；生产 Host decoder 另外丢弃过期杂志中的 24 条畸形项，该来源剩余 157 条均不匹配本书。上表按来源的最终状态统计，解析条数与来源数不是同一单位。单源未执行 L3–L5，搜索匹配不证明目录或正文可读。

HTTP 失败明细：轻小说百科 `lnovel.org` 404、菜小说网 `tatays.com` 404、歪歪书库 `yysk.net` 521、小原文学网 `min-yuan.com` 403、企鹅读书 `h5.reader.qq.com`（请求落在 `ubook.reader.qq.com`）404、企鹅阅读 `ubook.reader.qq.com/?g_f=4000001`（请求落在 `book.qq.com`）404。全部来源的精确 sourceId、名称、URL、Core sourceVersion、规则 fingerprint、条数、耗时和状态在 CSV/JSON 中保留。

## 起点与百度知道的特殊核对

起点不是本次诊断的静态 fixture。当前生产内置 preferred 规则 `enabled=true`、`defaultEnabled=true`，`builtinId=reader-builtin-qidian`、`builtinVersion=7`；`#ReaderTestBuiltin` 是沿用的稳定 sourceId 片段。实际搜索规则为 `/search?kw={{key}}&pageNum={{page}}`，以 `.y-list__item`、`h2@text`、`p.-4@text` 解析。本次真实 HTTP `m.qidian.com` 返回 200、113048 字节，Core 解析 20 条，其中一条是本书及“小夕岁”。生产 Gateway/Host/Window 没有按 QA、test 或 builtin 名称排除此源的逻辑；原规则 `checkKeyWord=青春` 没有覆盖本次明确传入的书名。

百度知道不是额外可用书源。其 `ruleSearch.bookList` 的 JS 直接从搜索 URL 的 `word=` 参数生成一条名称，`name=a`、`bookUrl=b`，没有 author 规则；不依赖问答结果是否提及本书。故这里只是合成的同名缺作者条目，不计入精确命中四源，也不视为发现了可读小说。

## 分母、执行入口与证据

内置 collection 为 1046 条，实际 `bundled-sources/index.json` 按 sourceId 选择最后版本后为 919 个 preferred 身份。其中启用 134 个；复用生产 `ReaderSourceCategory` 后，小说 101、漫画 20、音乐 8、其他 5。只执行全部 101 个启用小说源，未把旧导出重复项、停用源或其他媒体算入分母，没有按 provider family 合并。

标准 `target/debug/reader-cli` 缺失，旧 `target/corpus/reader-cli` 属于 9 月旧产物，未用于统计。本次经共享构建租约执行唯一必要构建：

```sh
node scripts/lib/build-resource-lock.mjs -- cargo build --locked -p reader-cli --target-dir target/check
```

耗时 39.94 秒，只有既有 kamadak-exif lifetime warnings。Core commit `9131ddcfeef1922620c6867f88fe82608e51a079`、dirty=true；`core.info` buildId 为 `fb84e3da93f0f399b10375ff664c4525dc4a8989d73c85321bd16396baf12964`，Cargo.lock SHA256 `093c02d6c0432f9e386eb5c6585ad4b531c6f2d6d05ba784006a756a79b695c4`。构建前 Core dirty diff SHA 记录于 plan.json。

现有 CLI `--json` 只输出下一个事件，不能持续服务搜索 HTTP；历史 `--test-source --legado-search-only` 会使用规则 checkKeyWord 且只输出首条结果，不能回答本次指定书名的完整列表。临时薄 runner 放在 ignored `.reader-artifacts/diagnostics/pc-source-search-20261024/`：复用当前 CLI `test_source.rs` 的 HTTP、Cookie、persistence adapter 原码及同次构建的 Core rlib，只补事件循环和元数据汇总，不复制或替代规则解析器。临时链接同样通过共享构建租约，无生产文件改动。

每源独立临时 SQLite，真实 `source.import → source.list → book.search`，由 source.list 获取真实 Core 规则版本；8 worker，峰值 8，单源从 book.search 开始整体最多 30 秒，HTTP 最多一次尝试，与阅读页换源默认预算相同。每个临时 DB 在进程结束后删除，未读取浏览器或手机账号会话。HTTP 响应只在内存交给 Core，证据不保存响应正文、请求头、Cookie、介绍或 continuation 值；书籍 URL DSL 的头部选项也从证据移除。证书校验保持开启。

然后用当前生产 `SourceSwitchGateway.decodeDiscoveryCandidates` 和 `admitsCandidate` 复核搜索元数据，使用生产标题/作者规则，而非在 runner 中另造匹配条件。该生产方法加载复用既有 source-switch-owner-probe 的编译入口，未运行其 fixture 或任何测试 case；唯一网络动作是上述 101 源搜索，没有测试、Native/HAP、HDC 或全量门禁嵌套。实际搜索命令：

```sh
node .reader-artifacts/diagnostics/pc-source-search-20261024/run.mjs
```

本机可审阅原始分类证据：

- [全部 101 源 CSV](../../.reader-artifacts/diagnostics/pc-source-search-20261024/sources.csv)，SHA256 `14f354dd096fc0f7e389ead30232212b532fe3eec298e7a39f9f75fb2f1e37f0`。
- [完整报告 JSON](../../.reader-artifacts/diagnostics/pc-source-search-20261024/report.json)，SHA256 `36537e8c8e8bd139a9d79a1805106a9a91e1f9eee40bc8b0226d9095fdb56b35`。
- 同目录 `plan.json`、`manifest.json`、`cli-info.json`、`summary.json` 记录入口范围、源清单、二进制/规则及 Core 构建身份。

这些是当前离线内置默认规则与 PC 网络环境的证据，不能强称与手机已安装规则、手机网络/WebView 或旧版本来源集合一致。没有为凑七个启用其他来源、撤销必要去重或放宽错书保护。
