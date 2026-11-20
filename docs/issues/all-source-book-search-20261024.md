# 全部现存书源：本书搜索阶段检测

本次范围由用户“所有已有书源全部测试”扩大后固定。阶段澄清尚未得到答复，已向用户说明按当前上下文先执行《还不起学贷的我只好兼职猎魔》、作者“小夕岁”的逐源 `book.search` 第一页搜索。**本报告完成的是全范围指定书目的 L2 搜索，不是 L3 详情、L4 目录或 L5 正文验收。** 未将 source.check 的源内 checkKeyWord 替换成本书，也没有把搜索命中解释为整书可读。

## 完成范围与结果

北京时间 2026-10-24 03:47:15 至 03:52:41，新增执行用时 326.044 秒。1607 条原始输入全部有可追溯映射，对应 1329 个 sourceId、1447 个 sourceId＋规则指纹组合。为保留名称、元数据对 JS 及 Core 版本的影响，仅对临时 enabled=true 后完整输入完全相同的项物理去重，最终 1478 个任务：

- 新执行 1372 个任务，真实 Core `source.import → source.list → book.search`；每任务独立临时 SQLite、进程和 Cookie session，8 并发峰值 8，单源搜索整体最多 30 秒，HTTP 一次尝试，无失败重试。
- 101 个任务输入及当前 Core/Host 方法身份与刚完成的启用小说源检测一致，明确记为 `REUSED`，引用该次 03:25:25 结束的 receipt 和 SHA；没有冒充本轮重新请求。
- 5 个非 HTTP 标识由实际生产 SourceGateway/HttpTransportPolicy 准入检查拒绝，记为 `HOST_PREFLIGHT_IMPORT_FAILED`；未伪称执行过 Core import 或搜索。分别为企鹅浏览 `novel.html5.qq.com`、刺猬猫说 `刺猬猫`、看书阁 `看书阁`、魔陌音乐 `魔音-MORIN`、南极小说 `🐧`。
- 129 条严格重复输入映射到上述任务，没有丢弃旧版本、没有使用 max-sources 截断。L3–L5、发现、图片字节、音频播放均为 `NOT_RUN`。

最终完成状态 `COMPLETE_WITH_FAILURES`，并非全量 PASS。物理任务分类如下；这是规则任务数，不能当成独立来源数：

| 结果 | 任务数 |
| --- | ---: |
| 精确书名与生产作者准入均通过 | 59 |
| 返回其他书名 | 250 |
| 空结果 | 492 |
| HTTP 失败 | 299 |
| 传输失败 | 122 |
| 规则 / runtime / Host decoder 失败 | 225 |
| 同名但作者缺失 | 11 |
| 同名但生产作者准入未通过 | 4 |
| 搜索超时 | 11 |
| Host 导入准入失败 | 5 |
| **合计** | **1478** |

空结果和返回其他书名不是同一类失败；规则错误也不能直接称为 Core bug 或永久坏源。HTTP adapter 调用观测合计 1594 条，其中本轮新增记录 1430 条、复用旧 receipt 记录 164 条；不能说本轮新发 1594 次。此数是下界：超时退出可能未输出末尾请求元数据，未据此伪造“没有请求”或补发网络采样。

11 个超时终态全部保留。其中仅 3 个 watchdog 退出项缺少末尾 Core sourceVersion；之后仅在同输入的全新临时库执行 `source.import → source.list` 恢复确定版本，**新增 HTTP 和 book.search 均为零**。恢复记为独立 receipt，没有用元数据成功覆盖搜索超时。

## 精确命中的正确分组

跨全部集合与规则版本去重后，精确元数据命中 **48 个 sourceId**，对应 **59 个 Core 规则版本**（55 个本轮新任务、4 个复用任务）。其中 **44 个按当前生产分类为小说，3 个为书籍信息源，1 个为下载源**。信息/下载元数据命中不能计入小说换源候选。不同站点或同站点不同 sourceId、同 sourceId 的不同规则版本分别记账，没有按 provider family 混成一个来源，也没有把版本数量当来源数量。

| 集合 | 全部输入 / 唯一身份 | 精确命中 sourceId | 小说命中 sourceId |
| --- | --- | ---: | ---: |
| 当前内置 preferred | 919 / 919 | 10 | 7 |
| 其中当前启用小说 | 101 / 101 | 4 | 4 |
| 其中当前停用小说，私有库临时启用测试 | 659 / 659 | 3 | 3 |
| 当前 raw 中非 preferred 旧版本 | 127 / 97 | 5 | 4 |
| 9 月 27 日历史可导入集合 | 556 / 556 | 45 | 41 |
| 历史非法标识 | 5 / 5 | 0 | 0 |

这些行存在集合和身份重叠，不能相加当总来源数。当前内置 raw 共 1046 条，对 919 个身份选择最后 preferred 规则；原启用 134、停用 785。当前分类为小说 760、漫画 95、音频 19、下载 19、外部 14、其他 12。历史集合原名“文字 432”的分类是历史证据；本次统一使用当前生产分类，其 556 条中小说为 429，不用旧分类数字冒充当前结果。

当前 **4 个启用小说命中**仍是：松鹤阅读、QQ阅读01、笔趣阁（尾斜杠 sourceId）、起点中文。当前 **3 个停用小说命中**是：企鹅浏览（优）`https://so.html5.qq.com/`、笔趣阁345-最终修复 `https://www.biquge345.com`、66书吧-起点 `https://66shuba.com`。未修改应用启用状态。以本次松鹤相同完整绑定为当前源时，生产窗口排除当前绑定后仍是 **3 个已启用替代源**，不是把全部停用/历史命中自动加进去。

全部小说 44 个身份的清楚拆解为：当前 preferred 命中 7 个＋当前 919 身份中另 2 个仅旧版本命中＋真正不在当前 919 中的历史身份 35 个。历史小说命中 41 个，其中 37 个身份不在“当前 preferred 命中身份”中；这 37 个不能全叫新增书源。当前非 preferred 另有企鹅浏览旧规则能匹配，已包含在历史命中中；它是同一身份恢复命中，新增 sourceId 为 0。它们说明集合、规则版本和启停状态确实会改变结果，但没有手机当前导入规则或旧版本七个来源名单，不能据此反推用户当时恰好是哪七个，也不能将此前受控 Host 七→三 fixture 当作这次网络结果。

## 相同 sourceId 的真实旧新规则对照

两项当前原启用状态都为 false；在各自私有临时库临时启用，只改变测试状态，没有覆盖应用规则。

| sourceId | 当前 preferred 实际结果 | 旧规则实际结果 |
| --- | --- | --- |
| `https://novel.html5.qq.com` | HTTP 200，解析 20 条，没有本书的精确书名 | 企鹅浏览旧规则精确返回本书与“小夕岁” |
| `https://www.owlook.com.cn` | HTTP 200，Core 空结果 | 历史 owlook 聚合搜索规则精确返回本书与“小夕岁” |

Core sourceVersion 完整对照：

- `novel.html5.qq.com` 当前：`ccc584ada824bbf15e0b22ca104e600d747ca7cf9f2967cf5d6257a88b544be9`；旧版：`2e0e37c8882e366d8eeaa7189bba572031f1e114846d64e1b7b3ad58ce6ae264`。
- `owlook.com.cn` 当前：`84d281d5d97e2022d8decac5fcdc4f6bc48118127903f9505a1ac37566056713`；旧版：`31c497d7d8577aafb2444bcc110787561d1e8af8654541927d4c5f77b9f2027f`。

这里只定位规则输出差异，不在本轮检测中修改生产规则或作者匹配逻辑。

## 作者准入与合成条目抽审

11 个“同名但缺作者”任务已逐条核对实际规则：全部来自百度图片或百度知道，JS 从 URL 的 word 参数合成 title，没有作者字段规则，不依赖响应是否真正提及本书。这 11 项都不计入 48 个精确命中身份。

4 个“生产作者准入未通过”分别为：

- 夸克：author 一并抓入“小夕岁”、推荐作者和其他作者，属于作者字段污染。
- 移动快眼看书：author 抓入分类、来源、更新时间等文本，属于作者字段污染。
- 移动言情小说：author 是“小夕岁著”，属于尾缀待清洗的潜在漏匹配；不能直接称为另一本书。本次保持现生产计数，不擅自放宽规则。
- 番茄苏念规则：同名书作者为“吾心飞翔”，与“小夕岁”存在实质差异，严格排除。

59 个精确命中规则的 ruleSearch 未含本书名或“小夕岁”的硬编码。该检查支持结果不是为本次关键词写死的 fixture，但仍不证明目录、正文或版权/付费状态可用。多个旧站点会呈现相似聚合结果，sourceId 数量也不代表相互独立的内容供应商数量。

## 全部小说精确命中身份

下表合并版本只列 44 个不同 sourceId；每条原始输入、规则指纹、Core sourceVersion、启用状态和耗时仍在完整 CSV 中。

| sourceId | 来源名称 | 当前身份状态 |
| --- | --- | --- |
| `https://so.html5.qq.com/` | 企鹅浏览（优） | 当前停用；preferred 命中 |
| `https://novel.html5.qq.com` | QQ浏览器 | 当前停用；仅旧规则命中 |
| `https://www.biquge345.com` | 笔趣阁345-最终修复 | 当前停用；preferred 命中 |
| `https://66shuba.com` | 66书吧-起点 | 当前停用；preferred 命中 |
| `https://bookshelf.html5.qq.com/` | QQ阅读01 | 当前启用；preferred 命中 |
| `https://bookshelf.html5.qq.com` | 松鹤阅读 | 当前启用；preferred 命中 |
| `https://www.biquge345.com/` | 笔趣阁 | 当前启用；preferred 命中 |
| `https://m.qidian.com#ReaderTestBuiltin` | 起点中文 | 当前启用；preferred 命中 |
| `http://api.basusan.com` | 顶点小说 | 历史集合；未证实手机已导入 |
| `http://api.jmlldsc.com` | 猫眼看书 | 历史集合；未证实手机已导入 |
| `http://api.jmlldsc.com##@曦灵` | 猫眼看书（优++） | 历史集合；未证实手机已导入 |
| `http://api.lemiyigou.com#` | 猫眼看书 | 历史集合；未证实手机已导入 |
| `http://api.lemiyigou.com/` | 猫眼看书 | 历史集合；未证实手机已导入 |
| `http://api.lfdapengu.com` | 猫眼看书（优++） | 历史集合；未证实手机已导入 |
| `http://api.xingliangglobal.com` | 鸡丁小说 | 历史集合；未证实手机已导入 |
| `http://m.badaoge.org` | 笔尖中文 | 历史集合；未证实手机已导入 |
| `http://m.kk169.com` | 穿越小说（魔法） | 历史集合；未证实手机已导入 |
| `http://m.rulianshi.la/` | 入殓师 | 历史集合；未证实手机已导入 |
| `http://m.yetianlian.la` | 何以笙箫默 | 历史集合；未证实手机已导入 |
| `http://m.yetianlian.la/` | 何以笙箫 | 历史集合；未证实手机已导入 |
| `http://www.4xiaoshuo.info` | 年代小说 | 历史集合；未证实手机已导入 |
| `http://www.badaoge.org` | 笔尖中文 | 历史集合；未证实手机已导入 |
| `http://www.balingtxt.com` | 八零电子 | 历史集合；未证实手机已导入 |
| `http://www.booksky.cc` | 快眼看书（优+） | 历史集合；未证实手机已导入 |
| `http://www.booksky.cc/` | 快眼看书 | 历史集合；未证实手机已导入 |
| `http://www.qudushu.org` | 去读书啊 | 历史集合；未证实手机已导入 |
| `http://www.rulianshi.org` | 入殓师灵异录 | 历史集合；未证实手机已导入 |
| `http://www.rulianshi.org/#pb1101` | 殓师灵异（优） | 历史集合；未证实手机已导入 |
| `http://www.shukuge.com/` | 365小说网 | 历史集合；未证实手机已导入 |
| `http://www.swsk.org` | 小说 | 历史集合；未证实手机已导入 |
| `http://www.xbotaodz.com` | 快眼看书（优+） | 历史集合；未证实手机已导入 |
| `http://www.xianqihaotianmi.org` | 言情小说 | 历史集合；未证实手机已导入 |
| `http://www.yetianlian.info` | 何以生肖 | 历史集合；未证实手机已导入 |
| `http://www.yetianlian.net` | 何以笙箫默小说电脑 | 历史集合；未证实手机已导入 |
| `https://7xdian.com` | 七点小说 | 历史集合；未证实手机已导入 |
| `https://bookshelf.html.qq.com/` | 松鹤阅读 | 历史集合；未证实手机已导入 |
| `https://bookshelf.html5.qq.com/kdread` | 看点阅读 | 历史集合；未证实手机已导入 |
| `https://m.zhongtianwen.cn` | 种田小说 | 历史集合；未证实手机已导入 |
| `https://novel.html.qq.com/` | QQ浏览器 | 历史集合；未证实手机已导入 |
| `https://www.1qxs.com` | 一七小说 | 历史集合；未证实手机已导入 |
| `https://www.owlook.com.cn` | owllook搜索 | 当前停用；仅旧规则命中 |
| `https://www.xiaoshuouu.com` | 幽幽 | 历史集合；未证实手机已导入 |
| `https://xdian.com` | 点小说 | 历史集合；未证实手机已导入 |
| `https://zhongtianwen.cn` | 种田小说 | 历史集合；未证实手机已导入 |

另外 4 个非小说身份：`https://pre-api.tuishujun.com/`、`https://pre-api.tuishujun.com`、`https://pre-api.tuishujun.com#md冷魅` 为书籍信息源；`http://download.maoyankanshu.la自用` 按当前分类为下载源，均不计入小说可换源身份。

## 可复核证据与执行边界

本轮没有改生产代码、实际源启用状态、真实用户库、书架、缓存或进度；没有 HDC、Native/HAP 或全项目门禁。复用此前同次调查构建的当前 Core CLI/rlib 和现有 CLI HTTP adapter，普通 TLS 校验保留，响应体上限 64 MiB，单次请求；网页、图片、音频依赖的 ArkWeb/登录/播放能力未在 PC 上伪造。响应只在内存交给 Core，没有写入原始正文、响应头、账号 Cookie、token 或 continuation 值；公开报告仅列来源元数据。原始规则仍只从本地已有文件读取，私有 manifest/逐条结果在 ignored 诊断目录。

真实执行入口为 `.reader-artifacts/diagnostics/all-source-audit-20261024/run-search.mjs`。输入文件三个 SHA 与 1607→1478 映射冻结在同目录 `input-inventory.json`；实际结果在 `search-results/`。这是用户明确要求的书源范围检测，不调用 gate-index、全量测试套件或历史 corpus 的隐式重试入口。

- [全部 1607 条输入明细 CSV](../../.reader-artifacts/diagnostics/all-source-audit-20261024/search-results/all-1607-inputs.csv)，含 sourceId、名称、集合、preferred/旧版本、原启用状态、规则指纹、实际 Core 版本及来源、复用/执行/准入失败、各类命中条数、HTTP/传输分类和耗时。
- [1478 个物理任务 CSV](../../.reader-artifacts/diagnostics/all-source-audit-20261024/search-results/task-results.csv) 与 [1329 个身份汇总 CSV](../../.reader-artifacts/diagnostics/all-source-audit-20261024/search-results/source-identities.csv) 分别用于版本级和身份级检查。
- [完整物理任务报告](../../.reader-artifacts/diagnostics/all-source-audit-20261024/search-results/report.json)，1478 条任务；[输入映射](../../.reader-artifacts/diagnostics/all-source-audit-20261024/input-inventory.json) 保留全部 1607 条来源。
- [分组摘要](../../.reader-artifacts/diagnostics/all-source-audit-20261024/search-results/summary.json)、[作者抽审](../../.reader-artifacts/diagnostics/all-source-audit-20261024/search-results/author-admission-audit.json)、[旧新规则对照](../../.reader-artifacts/diagnostics/all-source-audit-20261024/search-results/preferred-vs-legacy.json) 与无网络版本恢复 receipt 分开保存。
- `report.json` SHA256：`916bd2436457554ccc0dbb047793129162b0acf6abf2ffea0a4f95869831b17b`。
- `all-1607-inputs.csv` SHA256：`c39c2a5b2cb1bfa8fbcb4280a127e6d6b0d1a7b9d2828292977bd0d5f35bc2ac`。

若后续执行每源健康全链，可复用现有 `reader-cli --source-check-run`、明确 `reportVersion:2` 和选定 levels，每源一 command，整体 timeoutMs 包括前置步骤，不把 919 源塞进一个共享预算。该健康入口优先源自身 checkKeyWord，不能用来声称针对本书；mode=search 的媒体 L5 返回 not_supported 也不能当坏源。后续阶段须明确说明搜索关键词、章节选择、媒体证据和预算，再另记结果，不能从本次 L2 推断通过。
