# 松鹤阅读《还不起学贷的我只好兼职猎魔》正文失败

## 输入与证据边界

- 用户报告：该书在松鹤阅读书源下显示“本地内容暂时无法读写，请检查存储空间后重试”。当前安装候选由主任务核对；本轮源码为 HarmonyOS main `6b1bd753`、Core main `9131ddcf`，均含已有 dirty WIP。
- 本子任务仅查代码、已有诊断与公开书源读请求，不占 HDC、不修改真机/用户数据库、不清缓存、不构建。
- 旧记录 `reading-open-recovery-20261024.md` 和工作区 `evidence/2026-10-23-reading-open-diagnosis/` 记录了同一本书此前的泛化正文错误及恢复修复；它们没有本次新错误的原始 kind/code/command/category，不能用旧探针认定当前现场根因。

## 已定位的分类缺口

1. `ReadingFailurePresentation.readingFailureHint` 的本地读写文案由 `STORAGE_FAILED` 输出。
2. `remoteReadingFailureKindOf` 也把 `chapterNotDownloaded`、`cachedSessionUnavailable`、`cacheDerivedCorrupt` 转为 `STORAGE_FAILED`。这些分别表示未缓存、没有可用缓存目录或缓存未通过校验，并不证明磁盘读写故障。
3. 既有 `RemoteReadingFlowGateway.loadChapter` 在缓存正文为“请求参数错误，请稍后重试”等不可读占位时，抛 `RemoteChapterCacheRefreshError(code=cacheDerivedCorrupt)`，保留原正文及规范位置，等待显式刷新。现有 `cache-provenance` 测试明确覆盖这条实际调用链，但把最终文案类别断言为存储失败。
4. `classifyRemoteReadingCommandFailure` 还会仅因命令为 `cache.book.status` 将任意未识别错误定为 `storageFailure`，掩盖真实命令错误。明确的 `code/category=STORAGE_FAILURE` 必须继续作为存储失败；未知错误不能凭命令名证明存储损坏。
5. Core `reading_entry` 的真实 storage 错误经过 `storage_internal` 保留 `category=STORAGE_FAILURE`，但不公开原始数据库错误。没有本次设备结构化错误时，尚不能断定该书命中上述哪条路径。

## 公开书源请求（2026-10-24）

从当前仓库固定源 `tests/fixtures/corpus/sources/src-2869-9f23ceb11a82.json` 复用搜索、详情、目录及正文请求，只传公开书名/书目 ID；未传用户数据库、阅读位置、账号、Cookie 或私有凭据。

- 搜索 HTTP 200：精确书名，作者“小夕岁”，docId `90000001_1159836844`。
- 详情 HTTP 200：resourceID `1159836844`，书名/作者一致。
- 目录 HTTP 200：343 章，首章 serialID 1、“第1章 隐迹渐现”。
- 按源定义向 `https://novel.html5.qq.com/be-api/content/ads-read` 发首章 POST：HTTP 200、ret 0、一个 Content 条目；`data.Content[0].Content` 为一个字符串组成的列表，编码后 11288 字节，SHA-256 `4e42fda20f8e8b6f44d486a74572e36de235369da8c37d48957c7c7eed482ba2`；未见参数错误占位。不落盘完整正文。
- 初次统计脚本把列表当作字符串调用 encode 失败；修正统计脚本后得到以上类型/长度摘要。这是探针数据类型错误，不是应用失败。
- web 工具无法读取搜索 API，改用本机 urllib 对同一已知只读端点；未更改代理/系统权限。

这些结果排除“PC 当前完全取不到这本书”的说法，不证明手机请求环境、持久缓存、规范位置或当前正文排版正常。

## 定向验证计划（默认全部 OFF）

| 精确入口 | 范围、嵌套与本次必要性 | 结果 |
| --- | --- | --- |
| `node tools/test-remote-content-admission.mjs --case cache-provenance` | 实际 remote gateway 受控 Core 端口；仅该 case 和 Node TS 导入，验证坏缓存不误判存储/书源、不自动刷新，原位置上下文保留，显式刷新仍走规范迁移 | PASS（精确回执已取得） |
| `node tools/test-remote-content-admission.mjs --case failure-taxonomy` | 实际错误适配、分类及文案函数；仅该 case 和 Node TS 导入，区分明确存储、缓存缺失/需刷新、未知缓存命令错误；保留无空间优先语义 | PASS（精确回执已取得） |

未选择 Core 测试、全量、HAP 或设备检查。新增/修改的文案继续由原 `ReadingExperience.readingFailureContent` 的 `ReaderPageState` 展示，宿主、生命周期及动作仍由原 owner 管理。

## 未决与最小后续取证

代码已能定位误分类并在本地修复，但尚不能确定手机该书的直接失败入口。剩余问题只需既有日志中最近一次 `reader-failure phase/kind/guard/code/command/category`；若有真实 STORAGE_FAILURE，再围绕该 command 审计相应存储读取，不能由文案直接要求清数据或清缓存。设备读取仅由主任务按目标/租约与授权安排。

## 已实施分类修复与结果

- `RemoteContentAdmission.ts`：缓存缺失为 `CACHE_CONTENT_MISSING`，缓存校验拒绝为 `CACHE_CONTENT_REJECTED`，仅明确 `storageFailure` 保持 `STORAGE_FAILED`；三类都不作为新书源健康证据。
- `ReadingFailurePresentation.ts`：缓存缺失提示检查书源与网络；缓存拒绝提示原内容/位置保留并刷新本章；实际存储与 ENOSPC 专有提示保留。
- `RemoteReadingContract.ts`：未知 `cache.book.status` 异常继续携带原始 cause，为命令失败，不凭命令名升格成存储故障。既有 coordinator 仅 cache-missing/derived-corrupt 可回退，该保护未放宽。
- `tools/message-entrypoints.json` 仅更新原 PageState 的事实分类；没有新增消息宿主或自动动作。
- 两个精确 case 均 PASS。缓存拒绝用例实际经过 gateway，并核验没有自动 forceRefresh、没有产生假书源 verdict、原位置上下文保留、用户显式刷新走规范迁移。分类用例保留 code/category 两种真实 storage 错误及原 cause，未知缓存命令不吞错误，缓存提示不再要求释放空间，ENOSPC 仍优先。
- 既有 taxonomy 用例将 unsupportedHostCapability/invalidInput 的断言对齐此前生产映射（HOST_CAPABILITY_UNSUPPORTED/CONTENT_LOAD_FAILED），不是放宽生产保护；它们此前仍断言已退出的 RENDER_FAILED。
- 运行 `git diff --check` 仅覆盖本轮五个生产/登记/测试文件，无空白错误；不代表编译或设备验收。登记编辑首次脚本使用了错误的相对路径，FileNotFoundError 时没有写入；更正路径后更新成功。

## Core 窗口路径额外缺口（待处理）

`normalized_document_with_policy` 已将 `StorageError::InvalidSnapshot{field:"readingDocument"}` 作为可重建派生缓存，不伤原文；`document_window_locked` 的同类 `reading_document_window` 失败却直接 `map_err(storage_internal)`。因此受损派生窗口可以绕过已有整章重建并误报 STORAGE_FAILURE。建议仅把该特定派生错误标记 documentMissing，使 entry snapshot 复用规范重建；真正 SQLite/存储失败继续上抛。尚未改 Core、未运行 Core 回归，也未证明手机命中此路径。

### 纳入 Core 修复的定向验证依据

主任务已明确同意纳入上述派生窗口修复。仅选择 `workspace-tests` 的两个准确 lib case：

- `reader-runtime#lib#remote::reading_entry::tests::corrupt_derived_window_rebuilds_without_changing_original_or_positions`：生产 entry snapshot + 临时真实 SQLite；先证明受损 parts 在修复前进入 STORAGE_FAILURE，再验证已有 canonical 重建返回正确窗口、版本/Unicode/进度/书签/原文保持。NoHost 端口拒绝任何真实 I/O。
- `reader-runtime#lib#remote::reading_entry::tests::real_document_window_storage_failure_is_not_rebuilt_or_hidden`：临时真实 SQLite 将 String 列置为无效 BLOB，验证真实 row decoding 失败保留 STORAGE_FAILURE、不重建/覆盖，原文/进度/书签保留。

实际入口 `node scripts/check-local.mjs --stages workspace-tests --select 'workspace-tests:<上述准确选择器>' --rationale '<本次具体风险>'`。嵌套只有受控构建租约、`cargo test --locked -p reader-runtime --lib <准确名称> -- --exact --nocapture` 和回执验证；无全量、schema、业务套件、Native 产物构建或 HDC。编译仅为这两个生产路径回归的必需条件。

### Core 修复与真实生产路径结果

已在 `Reader-Core/crates/reader-runtime/src/remote/reading_entry.rs` 实施上面的唯一特定分支：`reading_document_window` 返回 `InvalidSnapshot(readingDocument)` 时按派生缺失处理；snapshot 随后复用原 `normalized_document_with_policy` 从保留原文重建。单独的 document-window 端点仍只返回 missing，不自行重建或 fetch。没有删除缓存、原文、目录、进度或书签。

| 准确 lib case | 结果 | 回执（Core 仓相对路径） |
| --- | --- | --- |
| `remote::reading_entry::tests::corrupt_derived_window_rebuilds_without_changing_original_or_positions` 修复前 | FAIL（预期红测）：真实临时 SQLite 坏 JSON 通过原 snapshot 抛 `storage operation failed` / `category=STORAGE_FAILURE`，并非 mocked throw | `.reader-artifacts/gates/1792780577337-d63a6682-f214-452c-ab2b-0cbbc4a6923f/receipt.json` |
| 同 case 修复后 | PASS：窗口正文与完整规范正文切片一致、Unicode范围有效，positionScope/原文/进度/书签保持；派生窗口可再次读取 | `.reader-artifacts/gates/1792780619813-a472f2f0-c42b-40d1-9338-d4d09af8a02f/receipt.json` |
| `remote::reading_entry::tests::real_document_window_storage_failure_is_not_rebuilt_or_hidden` | PASS：真实 SQLite String 列无效 BLOB 的读取错误仍 `STORAGE_FAILURE`，坏记录未被恢复分支替换，原文/进度/书签保持 | `.reader-artifacts/gates/1792780647425-9956bf6b-1ede-4f29-9c89-919147e60326/receipt.json` |

每次严格一个 case，704 个其他 lib 测试被过滤；`fullSuite=NOT_RUN`。仅编译 reader-runtime 测试二进制，未构建/签名/安装 Native 或 HAP。第三方 kamadak-exif 有四条既存 lifetime 风格警告，未修改依赖以消除无关警告。两个绿测后构建租约已释放。Core 单文件 rustfmt 及 diff 空白检查通过。

交付时必须由主任务统一重建配套 Core Native，再生成含本轮全部应用修改的 HAP；本机 Rust 测试二进制不能代替手机 SO。当前仍没有该书本次手机错误的唯一根因或真机阅读验收。


## 2026-10-26 用户再次报告多源换源失败（处理中）

用户报告《还不起学贷的我只好兼职猎魔》可搜索换源的数个来源几乎都出现“本地内容暂时无法读写”或“当前网络无法获取书籍”。当前已安装候选 `20261026T144417Z-3b297fdc-da2ad0fd`（签名HAP `0d63d0f2bfb8bc8e6312a19729cd644e9e307353be95927b0d1eeacffa6d5150`）此前仅验证v44书架恢复，不证明正文或换源可用。

初步代码审计：STORAGE_FAILED仍可能来自真实storage准入失败，不能据此让用户清空间；SOURCE_HTTP_FAILED是宽泛映射，不能直接归因手机网络。当前v44存储层已有restore publication上下文保护，而Runtime的SourceFetchMeta尚无resource publication绑定，这是需要本地复现的明确整合缺口。既有10月24日公开网络报告已区分搜索命中与正文可读，但不能作为当前网络结果。计划先执行临时SQLite下真实Core取正文/换源准入复现并核对具体几个来源的当前公开响应，保留既有数据/位置/回执，不先占用真机。


用户明确四源均失败，测试第78章。本次刚需入口：经build-resource-lock编译当前`reader-cli`（仅cargo build reader-cli，无测试/设备），随后`--test-corpus`指向仅含4条来源的私有manifest，keyword为完整书名、expected-author小夕岁、chapter-index77（零基第78项）、concurrency1、每HTTP最多1次、搜索/HTTP期限15秒，audit-sample仅有界首中尾片段/长度；不保存整章、Cookie、账号，不启用anti-bot求解。实际子链source.import/search/detail/toc/content使用生产Core与CLI Host HTTP适配。本机网络结果与手机保留规则、WebView分别记账。

当前已安装HAP和当前bundle都是161条来源，已不含起点；三个QQ/笔趣阁输入来自实际bundle。为诊断用户仍可选择的保留起点源，只读取Host HEAD跟踪的旧稳定`https://m.qidian.com#ReaderTestBuiltin`规则，明确标记历史输入，不能宣称它就是手机当前完整规则。其余三个起点变体不执行。manifest保存每条规则哈希与来源。

当前 PC 四源探针完成：QQ 两源目录序号78只返回50字截断；笔趣阁序号78返回1261字但混入其他小说段落，CLI长度门槛PASS不等于正文正确；起点历史留存规则目录HTTP404。补测笔趣阁标题第七十八章（目录序号79），避免章号偏移。代码已定位HTTP失败和未知commandFailed被泛化为网络故障；PC临时库不能判定手机原有数据库的storage准入原因。真机只读最小取证问题：当前应用既有reader-failure日志中的code/command/category是什么，是否为真实storageFailure或旧缓存拒绝。仅通过现有server租约读取该日志，不操作VM、不清日志、不重启应用/服务、不改变数据库。

### 本次结果与修复边界

- 当前Core CLI（生产实现，非设备）四源链结果在 `../Reader-Core/.reader-artifacts/diagnostics/hunter-ch78-20261026/results.json`。松鹤/QQ阅读01均仅50字。单独核验同请求的公开JSON：HTTP200、ret0，但Content[0].Code=15，ErrMsg=`get content err: ads read is not supported, ads status 0, ret:2`，ChapterInfo.Price=1000；源规则仅抽取Content，丢掉接口的失败事实。不推断用户购买状态，不绕过授权。元数据和响应哈希在同目录 `qq78-response-metadata.json`，未保存整章。
- 笔趣阁标题明确第七十八章（流势操演，零基index78）补测，返回1237字，两页都存在明显不连贯/其他小说人物段落；与第七十七章相同风险。`biquge-titled78.json`。CLI基于长度的L5 PASS只能说明提取到文本，不能认定正文正确；人工语义验收FAIL。
- 起点只是历史保留规则PC复现：目录HTTP404。手机实际留存规则尚未读到，不能推断所有起点规则相同。
- 代码修复：RemoteReadingContract对未分类commandFailed使用COMMAND_FAILED，RemoteContentAdmission将其归为CONTENT_LOAD_FAILED，不再污损书源健康；明确SOURCE_HTTP_FAILED仍保留HTTP分类/原始cause/状态码，但阅读和换源文案改为书源请求失败。明确NETWORK_ENVIRONMENT继续提示检查网络。一般STORAGE_FAILED不再无证据建议检查空间；ENOSPC等明确空间不足仍保留专门文案。沿现有ReaderPageState/Transient owner投影，更新message-entrypoints登记，未新增消息宿主。
- 定向验证PASS：`node tools/test-remote-content-admission.mjs --case failure-taxonomy,network-failure`；`node tools/test-source-switch-host.mjs --case public-failure`。覆盖404、未知错误、明确网络错误、存储错误和私有cause不进入文案。没有执行全量套件。
- 真机取证未完成：现有server下 exact target 的一次hilog读取返回E001005；随后一次只读list仅含VM target，未取得用户现场reader-failure。未重连、未改server、未操作VM、未清日志/数据。这里是当前HDC观测，不推断手机是否开启或用户操作有误。
- OPEN：手机真实STORAGE_FAILURE尚未定位；restore publication整合缺口目前是代码候选，未做真实库复现，不声称它就是现场根因。上游广告阅读拒绝、笔趣阁混杂正文、手机保留起点规则均未修复为可读。没有将搜索命中、长度通过、文案修复或构建视为阅读验收。

### 归因对照与交付记录

用户质疑Core/执行环境归因后补充独立对照：笔趣阁标题第七十八章用Python标准HTTP客户端、同源UA、禁用代理直接GET，绕过Core/CLI。HTTP200；#txt正文节点（html/body#moshi/div#neirong/div#txt）原始文本已包含同样不连贯人物/段落；Core首段6条均可在原始节点找到，无关段落与真实开头的祖先属性相同。`biquge78-direct-dom.json`保存原始响应SHA、节点路径、有界片段，无整章落盘。该证据只排除“这些无关文字由Core凭空制造”，不排除站点按UA/网络下发差异、网页JS恢复/规则不完整，也不证明所有运行环境都不可读。不能仅依据CLI长度PASS归因源站。QQ独立原始JSON同理仅证明当前请求被业务拒绝；规则忽略失败Code是本项目需要继续处理的准入缺口。

第一次构建ArkTS PASS，但工作区合同/环境脚本在期间变化导致整体FAIL，没有发布产物；失败回执 `hap-attempts/1793028011033-0f3b2766-87d5-467d-bdac-fc9b0f82bfc4/stages.json`。读取当前合同后重新构建成功：run `20261026T153053Z-3b297fdc-7169633e`，manifest `.reader-artifacts/hap/20261026T153053Z-3b297fdc-7169633e/manifest.json`，signed HAP SHA256 `6926733c953e51f47a50acb4724a37b5f1330c39d581db00cf0b3fcf0f96d4a0`；debug Profile和指定minliny_HarmonyOS证书验签PASS。Harmony HEAD `3b297fdc7e724cf655eca3bac2a8efeda2001c56`、Core HEAD `80d614e929ae9e320ab767a1dc04579363c361d7`，均dirty。只包含本次归因修正和工作树既有输入，未安装，不计为正文恢复或真机验收。

Core侧继续核对：`active_fence`只有实际restore fence/receipt存在才激活；没有两者返回None，因此“升级到schema44”本身不能证明publicationContextRequired已触发。Runtime仍调用未传publication上下文的commit_remote_chapter_positions；在存在恢复fence时是待复现的条件性缺口。另`storage_internal`丢弃StorageError，仅保留STORAGE_FAILURE，因此现有通用文案不足以区分准入拒绝、DB写入等原因。当前没有手机该次错误的底层事实，明确不能排除Core。笔趣阁静态脚本/CSS有界审阅另存biquge78-script-review.json，未取得浏览器/手机同请求的渲染对照，不能宣称已排除运行环境或规则遗漏。

## 2026-10-27 继续定位

新增唯一运行时反例 `remote::remote_content_positions::tests::sqlite_fixed_response_survives_metadata_restore`：完全不访问网络，固定合成正文，经现有松鹤真实规则/Host continuation，在同一磁盘SQLite分别执行恢复前与真实replace_library_metadata之后的新请求；断言两次均可发布正文。通过后续精确check-local选择该case，仅编译reader-runtime lib测试，验证有/无恢复fence这一单变量，其他suite不跑。预期用于证明或排除Core条件性缺口，不能冒充手机确有restore fence。

该用例首次运行FAIL在测试初始化的跨库restore_snapshot_before_image（LIBRARY_WRITE_SCOPE_STALE），还没进入正文路径，不能当作产品缺陷证据。已改为正常put_source/source_book/chapter_cache建立独立测试库，重跑同一case。浏览器对照已完成：IAB直接打开笔趣阁第七十八章，实际渲染正文#txt仍有与CLI/原始HTML相同混杂段落（第1/2页和第2/2页均在同一节点），不是仅静态抓取遗漏JS恢复；该网站当前这次浏览器响应本身不可作为完整章节。2026-10-27现有server一次租约list返回Connect server failed；没有重连或另起服务，后续设备命令停止。

### Core确定缺陷与修正

修正建库后的用例复现STORAGE_FAILURE；测试内采样底层错误为`InvalidSnapshot{field:libraryMetadataRestore.publicationContextRequired}`。进一步排除测试持有退休writer：恢复后重新open同一真实SQLite，再以合法新writer测试。最终反例包含负向控制——在已捕获/绑定的合法新请求中去掉resource_publication，仍稳定得到`RESOURCE_PUBLICATION_CONTEXT_REQUIRED`，且所有恢复行不变；保留上下文则成功。恢复前已发出的迟到响应仍拒绝，未通过放宽fence制造成功。

修复范围为SourceFetchMeta请求开始时捕获库观察值、正文capture绑定目标章节、两处canonical正文/位置提交改用已有owned storage接口。复用既有Storage的事务与nonce检查，无另造数据库协议。其他worktree只作只读实现参考，未修改。错误details新增封闭的storageReason码（缺上下文/过期上下文/过期writer/锁污染/其他），不放入SQL/路径/正文；Host只接受白名单并写入已有reader-failure诊断，不新增用户消息。

证据：Core精准case通过回执 `.reader-artifacts/gates/1793060732389-879ed570-661c-410e-a976-1b913ec0df54/receipt.json`；Host `failure-taxonomy`通过，拒绝任意SQL/路径字符串进入storageReason。另在同一case补上提交后再次冷启动从缓存读取的断言。生产Core缺陷已证实；尚无手机当前库fence/失败日志，不能把条件性复现写成手机唯一根因。原始失败和夹具错误回执均保留，没有删失败记录。

最新Core case回执 `.reader-artifacts/gates/1793060809694-c04d2480-514c-4b54-8b43-2bb504daf433/receipt.json` PASS，包含提交后冷重开/缓存读回。此前回执保留。为交付这一运行时修复，执行规范build-harmony-napi（嵌套OHOS Rust与CMake/Ninja、输入配套；host-probe/sdk-smoke默认NOT_RUN），随后sync-native和iteration signed HAP，合同none，不附带全量检查。

官方网页对照（IAB，2026-10-27）：`https://www.qidian.com/book/1049836819/?source=m_jump`当前目录有该书；点击“第七十八章 流势操演”进入`https://www.qidian.com/chapter/1049836819/920544254/`，页面明确“这是VIP章节 需要订阅后才能阅读”，仅提供开头（标注2198字）。该开头与笔趣阁#txt前段一致；笔趣阁之后是无关人物段落。未登录、未订阅、未操作验证码。官方存在有效目录，不应把历史移动源规则的404说成作品/官方全站不可用。手机留存规则仍待读取核对。

第二次HAP尝试 `1793061353138-c15d006c-f8bc-4945-86da-deafd1ee80af`：上述ArkTS错误已消除，但构建期间工作树输入从 `3a22b0245e04ca5ec95a44f3faf7e86612201d7aaa9f20c637e7fc50c37e9a72` 变为 `f2f9775968556826bedd5aaec93ad35936c02193e2c7a7bc40ee49bcc3d6bab2`，产物发布被规范流水线拒绝。结果FAIL，无本轮修复的有效HAP manifest，未安装。不能拿临时目录HAP或之前HAP替代。并行修改仍在发生，本轮不循环重打以争抢工作树。

按同标题对齐后的QQ两源均仅47字；独立Python HTTP POST绕过Core也得到HTTP200/ret0/Code15与ads read is not supported；ChapterID82，原始响应SHA `2ced5ab8cdfa1824119886fc0976a65ebf08259391a5777e042ab5d37db138a5`。元数据 `qq-titled78-response-metadata.json`。先前元数据字段rawContentCharacters是对Content字段容器len取值，已更名contentFieldLength；正文字符数以生产提取normalizedLength=47为准。

归因：Core恢复后缺publication上下文为已复现并修复的确定代码缺陷；QQ错误码被规则忽略且短预览被Host判readable为确定准入缺口，尚未修成完整正文；笔趣阁网页本身混杂与官方VIP为独立浏览器证据。CLI只按长度判L5 PASS曾给笔趣阁假阳性，人工verdict始终FAIL，不作为可读证明。手机现场STORAGE_FAILURE具体原因仍OPEN，缺失败日志，不推断用户手机/网络有误。

本轮Native build与sync-native PASS（SO SHA ca5f79ea2938290ef1936bab9052d66077355ed495faa7cb42dae43e5358d619）。HAP尝试1793061256786-87c3103c-30d2-479e-b835-772a5caa250b因当前UI源码编译失败：ReaderSearchFilterPanel.scale与CustomComponent冲突，Scroll的ForEach需单容器，LocalReadingExperience测量Blank不允许Stack父级；Index旧externalHeader参数在当前源码已由并行修改移除。只修正上述仍存在的三处编译约束，保留布局/回调/测量ID，重新执行同一HAP入口，不新增测试套件。
标题对齐QQ零基78为第79章流势操演，与官方第78章同标题；两源仍text_content_too_short。qq-titled78-plan.json记录精确输入和诊断CLI哈希（该CLI在publication修复前构建，只用于公开响应/规则提取对照）。
