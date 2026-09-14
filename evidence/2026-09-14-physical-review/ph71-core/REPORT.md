# 鸣龙正文转义问题：当前代码审计与最小生产链探针

日期 2026-09-14；子任务仅审计，不修改仓库生产/测试、不联网、不操作设备。Core HEAD bf3e2682051f0c5d84103800c1cec4e7140b203c（clean）；Legado HEAD 6763d061bc92b2164ac274363a807e4ed4be34e2（clean、只读）。Harmony 在父任务的 PH60/67 包工作中，阅读链仅只读；本报告不指代真机当前安装包已经包含修复。

## 用户现象与归因边界

搜索《鸣龙》/关关公子，默认“66书吧-起点”目录失败，换第二源目录成功，正文出现大量字面反斜杠 r/n。没有取得该第二源 ID/规则版本、当时正文 HTTP 响应或 Core 输出；不能把下面的已证实通用缺陷直接宣布成该第二源唯一根因。不要求用户回忆源名，不扫真实源。

已排除当前代码中的一种猜测：正常 JSON 转义被 JSONPath 或 QuickJS 重复转义。生产方法探针中 JSONPath/JS `JSON.parse` 提取真实 CRLF 均返回真实换行；Host 原样消费 Core 字符串，未额外 stringify。字面 `\\r\\n` 及 Windows 路径保留是正确行为；Legado 的通用正文 formatter 也没有无条件反转义步骤。因此绝不能在 ArkUI/Host 做全局 replace 来掩盖问题。

## 已定位的确定缺陷

### A. ruleContent.replaceRegex 被当成错误的字段对使用，独立规则不执行

Reader `crates/reader-content/src/lib.rs:3499–3512` 在单页 HTML 规范化之前调用 `apply_content_replacement`；该函数 `:5968–5990` 在 `sourceRegex` 为空时立即原样返回，否则把 `sourceRegex` 当正则匹配，把 `replaceRegex` 当替换字符串。

当前 Legado `app/src/main/java/io/legado/app/model/webBook/BookContent.kt:166–175` 是每页提取/HTML 格式化、合并整章、trim，然后将 **replaceRegex 独立当完整 AnalyzeRule 执行**。它可包含 `##`、JS 或其它已支持规则，既不是固定 replacement 字符串，也不依赖 sourceRegex。

Legado `model/webBook/WebBook.kt:456–458` 则把 sourceRegex 交给网络/WebView 层；`ContentRule.kt:18–19` 保持独立字段。Reader 的 sourceRegex 当前只被错误的正文替换和规则存在检测引用，内容请求只传 webJs，没正确接入资源匹配语义。不能用 sourceRegex 删除正文。

三项最小生产方法失败：
- content=`正文广告`，replaceRegex=`##广告`，sourceRegex 空 → 当前 `正文广告`，应该 `正文`。
- content 为字面 `甲\\r\\n乙`，replaceRegex 显式调用 JS 将该已知源分隔符转换为 LF，sourceRegex 空 → 当前规则被跳过；应 `甲\n乙`。该样本证明一个确切可产生用户现象的代码缺陷，**不证明第二源使用了此规则**。
- content=`正文`，sourceRegex=`正文`，replaceRegex 空 → 当前变成空串，应该保持正文（资源匹配不得改正文）。

本机内置集合有 1046 条；其中 **183 条**填写 replaceRegex 但 sourceRegex 为空。是配置命中统计，不是 183 个在线源已实测失败。三个 66 书吧变体（索引 57、126、1027）正文规则一致（规则 canonical JSON SHA 前16位 `feb32cdb172c2054`），两字段均空，故本缺陷不能解释该源本身 TOC 失败；用户出现乱码的第二源尚未知。

### B. 远程正文仍使用手写 HTML 解析/实体表，已有上游未完整复用

Reader `crates/reader-content/src/normalization.rs:159` 分流，`:267–316` 手扫尖括号，`:487–550` 小型实体表。与已替换的简介/EPUB 路径不同，远程正文仍保留此实现。

生产方法探针明确输出：
- `<p title=\">\">甲</p><p>乙</p>` → 多出 `\">` 属性残片。
- `<p>甲</p><script>bad()</script><style>bad{}</style><p>乙</p>` → `bad()bad{}` 留入正文。
- `<p>甲&copy;&lrm;&eacute;</p>` → 三种实体留作文本。

实体与属性残片属于准确归因；script/style 的拒绝是 Reader 正文质量要求，不应声称 Legado 当前 regex formatter 已全部消除此类情况。Legado `HtmlFormatter.kt` 自身仍是基于正则的格式化；Reader 不得复制/翻译 GPL 实现。

当前已有 `scraper 0.19.1` / html5ever 依赖，`normalize_display_intro` 和 EPUB 路径已复用。`reader-js/src/lib.rs:3388` 的 java.htmlFormat 还存在第二套手写扫描/小实体表，需纳入同一修复，不能只改最末端。两 crate 均已有 scraper，可抽出无依赖环的共用 HTML 投影薄适配模块，HTML tokenizer/实体由上游提供；仅段落、图片保留与业务清理策略由 Reader 定义。

### C. 分页正文粘连，且全文净化时序错误

`reader-runtime/src/remote.rs:9680–9686` 对下一页 `push_str`，没有分隔符。每页 normalize 已 trim 边缘换行，所以页末/页首段落会直接粘连。Legado `BookContent.kt:166` 在分页间加 LF。此项为生产代码直接定位；本轮未另跑完整 Runtime 多页 Host fixture。

全文 replaceRegex 必须在**所有页合并后只执行一次**，不能逐页应用：跨页正则、首尾锚点、有状态 JS 和整体 JSON 文本处理的结果不同。

## 正确链条与完整修复约束

1. Host 保留 HTTP 字节/响应元数据；Core 现有 encoding_rs 负责字符集，现有 serde_json / QuickJS 在规则声明的 JSON/JS 边界解码。不得对所有正文做第二次 JSON.parse 或反斜杠替换。
2. 每页执行 content 规则，再由同一上游 HTML parser 投影为正文和受约束图片标记；保存每页 continuation，并在分页之间保留 LF。无下一页、循环、最大页数/取消仍走原有有界逻辑，不能把不完整章节作为成功发布。
3. 在整章结束边界，复用现有完整规则引擎执行独立 replaceRegex；允许规则显式进行 JSON/string 转换。按已审计顺序 trim 合并文本再运行，变量/原始第一响应/currentUrl/chapter/book 等上下文完整保留。不得创建通用反转义器，或把规则错误静默变成成功正文。
4. sourceRegex 不再参与正文修改；单独进入现有 WebView 资源匹配能力合同。若尚未接通该能力，应返回明确能力失败，不能假装正常正文替换。该部分需与 Host 请求合同及已存在 WebViewGetSource 能力对照接入，不能擅自改用户书源。
5. 新获取的 canonical source 正文在源全文净化后缓存；每次展示再使用当前用户替换/简繁/重复标题设置，避免缓存重读重复执行有副作用源规则。`finish_chapter_content_result`/分页结束/显式 JS 路由与读取缓存都要审计，不能只改单页 public helper。
6. 缓存/位置保护：不批量清空原章节、书架或进度。旧缓存没有原始响应，不能宣称重新规范化能还原已删正文；新缓存需绑定正文处理版本。老缓存需要重新取得正文时，只替换成功且通过准入的新结果，失败保留旧文和当前位置；映射由 Core canonical anchor 负责。不要自动通过换源去覆盖已入架书籍。
7. Host 继续原样投影，不额外改字符串长度。更新后正文可见文本、search.content、书签摘录、TTS、UTF-16/scalar 位置与图片块范围必须源于同一 Core 投影。

## 本地验证矩阵

现有 12 项探针只针对生产 `RemoteContentPipeline::content_book_source`，不能替代真机和真实源：
- 6 正确保护/解码通过：JSONPath CRLF、JS JSON.parse CRLF、合法代码/路径、双层字面保留、源显式嵌套 JSON 解码、pre 中代码原文。
- 6 当前失败：上述独立净化/显式转义净化/sourceRegex误删 3 项 + HTML 属性/脚本/实体 3 项。
- 实施应补：两页全文规则只跑一次、跨页边界、规则状态/取消/错误保旧、图片 src 内引号与 URL DSL、textarea/pre/真实 RTL/emoji joiner、旧缓存到新版本位置映射、原有 HTML/TXT/EPUB 与 audio URL 路径不回归。
- JS `java.htmlFormat` 与章节最终规范化必须跑相同 HTML 结构样本，避免只修其中一处。

## 最小剩余取证

代码修复和 fixture 先完成。要闭环《鸣龙》这一本的字面字符，最小证据是同一次点击中 source ID/规则摘要、选定章节 URL 摘要、各阶段长度/摘要/真实LF与字面\\r/\\n计数；若计数首次异常的阶段仍无法解释，再保留一个脱敏小响应和规则输出局部片段。本轮没有拿到这些，不能编造确切第二源原因。可优先从已存在本地记录/缓存取证，不启动全量扫源，不要求用户回忆名称。若最后只能由设备取得，父任务按用户授权、代码侧无法定位清单和最小取证范围另行判断。

## 原始文件

- `/private/tmp/minglong-text-audit/probe.rs`：独立 harness，链接当前仓库正式 build 的 reader-content/domain/serde_json。
- `/private/tmp/minglong-text-audit/results.jsonl`：12 项实际输出。
- `/private/tmp/minglong-content-build.jsonl`：cargo build -p reader-content --offline 的实际构建产物清单。
- 初次 rustc 在根 cwd 调用误用了 1.96.0，与该仓 pinned 1.97.1 不匹配；已改为在 Core cwd 运行匹配 compiler，未 clean、未修改 toolchain。该失败是探针运行配置错误，与产品无关。
