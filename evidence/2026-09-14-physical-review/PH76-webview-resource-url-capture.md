# PH76：WebView sourceRegex 真实资源地址捕获

状态：生产薄适配与本地回归已完成；ArkTS/HAP 集成、VM 回调行为、真机和用户验收分别未在本记录中完成。不得将此项推导为《鸣龙》未知第二书源的现场原因或修复验收。

## 事实修正与来源

本次审计基于 Core 基线 `316ed8362d4d820756f22f22bee35fd4d5f932a9` 上的工作区修改；Legado 只读基线 `6763d061bc92b2164ac274363a807e4ed4be34e2`。未抓取用户源响应、未修改用户数据、未操作设备。

之前“sourceRegex 必须取得资源响应体，否则只能 unsupported”的判断不成立。当前 Legado `BackstageWebView.kt:342` 在 `onLoadResource` 中用完整正则匹配资源 URL，首个匹配结果作为 `StrResponse` 的 body 返回；原页面地址仍是响应地址。`JsExtensions.kt:268` 明确该方法获取资源 URL，后续 AnalyzeUrl/WebBook 仍按规则处理这个字符串。此次仅据行为合同实现，未复制 GPL 实现。

目标 SDK `ets/component/web.d.ts:6503,9220` 已定义真实 `OnResourceLoadEvent.url` 和 `onResourceLoad`。平台的 `WebHttpBodyStream`/`getHttpBodyStream` 指的是上传请求体；`WebResourceHandler.didReceiveResponseBody` 是由应用向 Web 内核提供响应，不能据此声称被动取得内核响应体。可以通过 SchemeHandler 接管网络并转发，但本需求不需要新增这条复杂传输栈。

官方主要资料：[Web 事件文档](https://raw.githubusercontent.com/openharmony/docs/master/en/application-dev/reference/apis-arkweb/arkts-basic-components-web-events.md)、[SchemeHandler 文档](https://raw.githubusercontent.com/openharmony/docs/master/en/application-dev/web/web-scheme-handler.md)。前者列出资源回调；后者区分请求体流与向内核提供响应。平台判断还逐项核对了本机 DevEco SDK 声明，未将网页简介作为能力证明。

## 当前实现与合同

1. Core `remote/resource_capture.rs` 复用现有 QuickJS 的 `RegExp` 编译能力，生成 `(url) => boolean`。源正则只经 `serde_json` 编成字符串参数，不作为脚本拼接；URL 由 Host 使用 JSON 参数编码。完整匹配明确检查 `match.index === 0` 且 `match[0].length === url.length`，避免子串匹配和 `$` 对尾换行的差异。没有新增正则解析器。
2. `ruleContent.sourceRegex` 仅在 URL 计划实际启用 WebView 时接入。普通 HTTP 继续忽略此字段。GET WebView 与 POST 先 HTTP、再 HTML WebView 均传递同一匹配器；原 response/book/chapter/continuation 和后续内容规则链保持原有归属。
3. `java.webViewGetSource` 使用同一匹配器和真实资源回执，删除 `performance.getEntriesByType('resource')` 猜测分支。普通 DOM WebView 和 override URL 分支未扩大重写。
4. 既有 `webview.evaluateJavaScript` 请求新增可选 `resourceUrlMatcherJavaScript`，结果新增可选 `resourceUrl`。资源模式必须返回非空 `resourceUrl === value`，否则 Core 明确拒绝；旧 Host 不可把 DOM 或时间线结果静默充当资源。没有请求该能力的旧调用保持原合同。Core/Host 应一同交付。
5. `ArkWebExecutionHost.ets` 直接转发真实 `.onResourceLoad(event.url)`。`ArkWebExecutor` 在加载前安装完成信号，回调逐个进入有界串行匹配队列。前一条匹配求值未完成时，后一条不能抢先胜出。首次匹配直接完成，不经过稳定页面的 500 ms 等待，也不重新下载资源。
6. 若资源需要源初始化脚本触发，页面完成后按既有 500 ms + 显式 delay 执行一次初始化；已有匹配可在这之前完成。成功/失败/超时/取消/卸载均清理 deadline 和初始化定时器。matcher 和初始化异常明确返回脚本阶段错误，不缓存脚本原文。
7. 保留已有串行 WebView、DNS pin、同主机网络准入、独立源 profile 的 cookie 注入/回收、会话 generation、取消和 deadline。旧任务异步 matcher 完成会再次核对任务身份与已结束状态，不能发布到新任务。

资源预算：源正则 8192 UTF-8 字节；生成 matcher 最大 65536 字节（Host 同时限制字符数）；每任务最多接纳 128 次资源事件、单 URL 16384 UTF-16 单位、累计 URL 524288 单位。溢出终止标记保持在原回调顺序中，已接纳的较早匹配仍能胜出；不继续扩展队列。预算与 deadline 均沿明确错误退出，不降级为正文替换。

## 文件范围

- Core：`crates/reader-runtime/src/remote/resource_capture.rs`、`host_callback_bridge.rs`；`remote.rs` 的 URL 计划/Host continuation/回执钩子；`reader-contract/src/host.rs` 及既有 iOS adapter DTO 构造测试；两份协议 schema 的 WebView 定义。
- Harmony：`entry/src/main/ets/app/ArkWebExecutor.ts`、`ArkWebExecutionHost.ets`、`tools/test-arkweb-resource-capture.mjs`。
- 本项未改存储正文/历史缓存、阅读位置、EPUB、Host 网络转发栈；PH75 由独立事务修复处理。

## 本地验证记录

| 实际命令 | 结果与证据 |
| --- | --- |
| `node tools/test-arkweb-resource-capture.mjs` | 19 个生产方法场景通过，`PH76-host-resource-tests.log` |
| `node tools/test-arkweb-network-policy.mjs` | 原有 DNS/同主机/session/cookie 范围回归通过，`PH76-network-policy-tests.log` |
| `cargo test -p reader-runtime --lib --offline resource_capture` | 4 项通过；含两项 matcher/回执与两项真实桥回调；`PH76-core-resource-tests.log` |
| `cargo test -p reader-runtime --lib --offline content_resource_matching_is_not_a_text_replacement_or_timeline_guess` | 1 项通过；HTTP/WebView/POST 计划，`PH76-core-content-request-tests.log` |
| `cargo test -p reader-runtime --lib --offline host_callback_bridge::tests` | 44 项通过（包含前述 2 项桥回调，不重复计为新增），`PH76-core-bridge-tests.log` |
| `cargo test -p reader-contract --offline webview` | 7 项通过；包括新匹配器长度/空值与回执相等/长度边界；`PH76-contract-webview-tests.log` |
| `cargo clippy -p reader-runtime -p reader-contract --lib --tests --offline -- -D warnings` | 通过，`PH76-clippy.log` |
| `python3 tools/protocol-schema-lint/protocol_schema_lint.py` | 269 fixtures，unexpected invalid/valid 均 0；`PH76-schema-lint.json` |
| 既有 contract drift 脚本 `--strict` | 通过，`PH76-contract-drift.log` |

Host 测试直接载入生产 TS 实现，以确定性时钟和平台 controller 替身驱动真实生产方法；不把替身宣称为真实浏览器。19 个场景包括页面完成前即时匹配、延迟求值保序、初始化一次、较早匹配优先于预算溢出、超时/取消/卸载/会话失效/网络拒绝/预算/返回类型错误、cookie profile 隔离、POST HTML、matcher 异步拒绝/同步抛错、初始化错误、加载错误、旧 matcher 延迟完成不侵入下一任务、可执行形状 URL 的安全编码。均检查任务归零、active 清空和定时器归零。

初次 Core 定向编译遇到同时施工 PH75 的 3 处 `position_basis` 缺少字段；已由对应 owner 补齐，原失败保留为 `PH76-core-integration-initial-failure.log`，不是删除失败后声称一次全绿。较早完整 contract 测试 511 项通过，但之后新增了本项 DTO 边界回归，因此末版只按以上真实重跑范围报告；全仓终审由集成 owner 统一执行。

## 尚未证明的边界及最小平台验证

- **正则兼容有具体边界。** 使用现有 JS RegExp，不宣称覆盖 Java/Kotlin 所有正则语法。例如 `(?i)abc` 在 Core 明确返回 `RESOURCE_URL_REGEX_UNSUPPORTED`；不自研翻译器。QuickJS 与 ArkWeb RegExp 引擎差异如导致运行失败，也明确终止，不返回虚假的未匹配成功。通用脚本执行自身的内核中断能力不由此事件预算替代。
- **网络准入没有扩大。** 既有 WebView 只允许经过 DNS pin 的文档同主机资源；跨 CDN/其他主机将继续按网络政策拒绝。此项实现不代表所有 Legado 源跨域可用。
- **页面完成前的真实控制器求值待 VM。** 本地证明了回调可提前进入生产队列且无 500 ms 等待；SDK 声明不能证明不同 Web 内核版本在每个早期资源回调时已允许 `runJavaScript`。最小 VM 用固定无凭据页面，分别加载即刻/延迟两个资源，记录回调、求值和完成的时间与顺序；若早期求值失败，须先记录错误并据平台生命周期作有限适配。
- **连续导航的原生迟到回调待 VM。** `OnResourceLoadEvent` 只有 URL，没有导航 ID。当前 stop/about:blank 清理、同主机限制和任务 generation 可阻断已发起的旧 matcher 异步回执，但仅凭声明不能证明上一页面的原生 URL 回调永远不会在下一同主机任务开始后送达。最小 VM 固定两页同主机，第一页延迟资源后取消，第二页立即启动，记录真实回调归属；不同 profile cookie 内容使用合成标记，不能抓用户凭据。如果出现跨导航迟到，应复用平台控制器/组件生命周期隔离补齐，不能拿仅含 URL 的回调猜测任务归属。
- **验收分层保持开放。** 上述精确 VM 问题尚未做；ArkTS/HAP、VM、真机及用户验收由总任务另行记录。这些不是新增产品决策，也不把未知第二源的字面转义问题归到 PH76。

## 已实施的既有 pilot 诊断模式（待 VM 执行）

2026-09-14 后续在根任务明确授权下，已在原 `ReaderRendererPilot.ets` 增加 PH76 模式，新增 `app/ArkWebResourceDiagnostic.ts`。未新增页面、启动参数、Core 实例或用户书源；仍由现有 `DEBUG === true`、`BUILD_MODE_NAME === 'debug'`、冷启动原始 boolean `readerOpenSourcePilot=true` 才可进入。暖启动不会替换页面，两个诊断参数冲突仍回普通 Index。

原试点的 Foliate Web 与 PH76 模式分别挂载。PH76 模式挂载同一个生产 `ArkWebExecutionHost`，直接调用真实 `ArkWebExecutor.execute/cancel`；不伪造 `onResourceLoad`，不使用 performance timeline。原 Core→Host 合同与桥接已经有独立本地回归，此 VM 切片只回答两个 ArkWeb 平台回调问题。

**受控响应与数据边界。** 固定 `https://93.184.216.34` 仅作为内存文档 origin；每次生成独立 `/reader-ph76/<time>-<run>/` 路径。不是私网豁免，不修改现有网络判定，也不实际访问该 IP：生产 Host 仍先调用 `blockNetworkUrl`；随后仅 pilot 传入的 provider 使用平台 `WebResourceResponse` 返回固定 CSS/脚本。最初遗漏了主文档准入，2026-09-15 补正后仅本轮精确主文档获准（见下文），其他请求保持 403。没有本地服务器、端口映射、域名解析、Cookie profile 或书源导入。异步响应使用目标 SDK 已声明的 `setResponseIsReady(false/true)`，实际资源请求与回调仍由 Web 内核完成。

provider 默认 undefined，在 pilot 分支生命周期内才挂载，Host 卸载时同步清除。新增 runner 的 dispose 同步移除自己的 observer、释放待返回的内存响应和定时器，仅取消固定请求 7600001/7600002；没有遍历/取消非 runner 请求、关闭全局 runtime 或清理用户持久数据。正式单测保留一个非 runner 请求并断言其未被取消。整块 Host 组件卸载仍使用原有 detachController 生命周期（失效控制器上的当前任务会按既有合同取消），本轮未改；这里是独占 debug 冷启动页，不将 runner 的有界清理扩大承诺为任意普通 Web 请求在控制器卸载后还能继续。测试还覆盖 observer 抛错不改变生产选择结果。observer 仅在执行受控样本时挂载；日志包含生成 token、时间、请求 ID、有限资源标签，任何不受控 URL 不输出。

### 根任务的最短 VM 步骤

先由负责 VM 的根任务完成当前 manifest 绑定安装及其既有 target/boot/占用确认。本子任务没有操作设备。以下 serial 是根任务已确认的该次 VM 目标；若目标变化须重核，不可照搬历史值。

在当前应用没有未完成用户操作时，执行既有 debug 冷启动：

```sh
PH76_HDC=/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc
"$PH76_HDC" -t 127.0.0.1:5555 shell aa force-stop io.reader.harmonyos
"$PH76_HDC" -t 127.0.0.1:5555 shell aa start -a EntryAbility -b io.reader.harmonyos -m entry --pb readerOpenSourcePilot true
```

依次点击 **“PH76 资源验证”**（ID `reader-ph76-open`），再分别点击 **“验证早期资源回调”**（`reader-ph76-early`）、**“验证取消后资源归属”**（`reader-ph76-cancel`）。任务进行时按钮禁止重复点击；页面顶部显示通过/未通过及简要测量。无需在 shell 伪造点击坐标，可按实时 UI 中的标签/ID 操作。

每次执行后读取单次结果：

```sh
"$PH76_HDC" -t 127.0.0.1:5555 shell hilog -x -e READER_PH76_RESULT
```

日志 tag 为 `ReaderPh76Pilot`，消息前缀 `READER_PH76_RESULT` 后是 JSON。按新的 `runToken` 取本次记录，不能把旧通过结果当成新版本证据。**每个按钮正常约 0–2 秒完成；合理观察上限为 6 秒**（执行器每请求 4 秒、旧请求拦截等待 2 秒，两个阶段受控串行）。超过 6 秒且无结果属于失败/未完成：保留日志并停在代码定位，不连续反复点击或扩大等待。

### 预期 JSON 与判定

共同键：`scenario`（early/cancel）、`pass`、`runToken`、`measurements`、`events`、`network: "in-memory-only"`、`scope`。每个事件包含 `kind`、毫秒 `at`、可选 `requestId` 和受控资源 `resource` 标签。`resource` 事件的 requestId 表示**收到事件时的 active job**，不是声称平台提供了原始导航 ID；原生事件只提供 URL，正因如此用 old/new 资源标签交叉判断。

- **early**：内存 HTML 同时请求 `early.css` 与延迟 700 ms 的 `hold.js`；匹配 early.css。通过要求返回真实 `resourceUrl` 正确，且存在该资源的 `resource`/`matched` 事件；匹配发生在该任务 pageEnd 之前，或完成时尚无 pageEnd。输出 `callbackToMatchMs`、`matchedBeforePageEnd`。事件中实际 `matcherStart`/`matched` 用于判断控制器在早期回调阶段能否求值，不能只拿总耗时猜测。最初非受控形态的页面事件仅记 `unlabelled-document`；2026-09-15 起区分 about-blank、data-document、blob-document、other-http-document、other-document，仍不输出地址，也不会因隐藏 URL 而删除 pageEnd。
- **cancel**：第一任务请求延迟 700 ms 的 old.js，但使用永不匹配的目标；收到真实拦截后主动取消，必须实际得到 CANCELLED，才能启动第二任务。第二任务请求延迟 1000 ms 的 new.js，其 matcher 故意同时允许 old/new，确保旧 URL 误归属能被检测。通过要求返回 new.js，且第二任务 active 期间没有 old.js 的真实资源回调。输出 `returnedResource: "new.js"`、`observedLateOldCallbacks: 0`、`callbackToMatchMs`。
- 执行器/控制器失败、无受控请求、错误旧任务终态等，返回 `pass:false`，`measurements` 包含 `code`/`reason`，仍保留事件轨迹。不能将“未收到回调”当作资源已经正确隔离。

通过仅证明该版本/该 VM/这次固定调度的受控样本，**不证明永远不会出现迟到原生事件**，也不证明所有网络源/正则兼容。此处无真实网络负载，不能推导公网连接、Cookie、CDN 或不同 Web 内核调度全部验收。

### 诊断模式本地门禁

- `node tools/test-arkweb-resource-diagnostic.mjs`：5 组 runner/provider 单测通过，含旧 token 跨任务的正反例、卸载、失败回执、默认关闭和网络策略先行。平台替身只用于本地测试，诊断生产入口没有手工调用 onResourceLoad。
- 原 `test-arkweb-resource-capture.mjs` 19 场景再次通过，并加入 observer 抛错不影响选择的断言；原 network policy 与 debug 冷启动门禁通过。
- 新 TS helper 用目标平台 API 形状声明做普通 TypeScript strict 检查通过；不是 ArkTS 或 HAP 编译结果。最终 ArkTS/HAP/VM 由根任务补齐。
- 日志：`PH76-diagnostic-runner-tests.log`、`PH76-host-after-diagnostics.log`、`PH76-diagnostic-network-policy.log`、`PH76-pilot-launch-test.log`、`PH76-diagnostic-typecheck.log`。

## 首次真实 VM early 失败（2026-09-15，代码定位中）

Root 在 aa387 包的隔离 pilot 执行 early，得到 `TIMEOUT`。现有 `/private/tmp/ph76-vm-early-hilog.log` 的本次 `READER_PH76_RESULT`（runToken `1789408759514-1`）只有 start、pageBegin(unlabelled-document)、pageEnd(unlabelled-document)、end，约4秒后失败，无资源/intercept/matcher事件；UI回执为 `/private/tmp/reader-ph76-vm/reader-control-ph76-early-result.json`。日志中较早的在线搜索记录不属于本次受控样本。

本次失败表明受控资源并未进入已观测的回调链，不能说早期JS求值或跨导航归属已经通过；也不能先断言失败来自正则或DNS。当前先核对真实 `loadData` HTML/baseURL、Web初始导航与组件控制器生命周期。Root 正在构建 acbea857 产物，生产修改须先告知并协调冻结；本节记录时尚未修改生产或进行额外设备操作。


## 主文档诊断准入修正（2026-09-15，本地冻结，VM 待有效重验）

**代码已确认的缺口与未决因果。** 原 provider 仅让 `about:blank` 返回 null，只有 early.css/hold.js/old.js/new.js 返回 200；本轮 `loadData` 的精确 HTML 如果以 data 主文档或 base/history URL 的 page 进入拦截，就被返回空 403。原拒绝分支没有事件，因此首次 VM 的“无 intercept”不能推出 native 从未调用拦截。原测试直接提供四个资源再手动注入模拟回调，跳过主文档边界。新断言在修改前退出 1（runner 捕获内部主文档准入断言，early 的 pass 为 false）；失败日志保留为 `ph76-document-admission-before.log`。**旧 VM 日志没有原始文档 URL/拒绝标签，尚不能据此确认该缺口就是本次超时的唯一根因。**

**已排查且未改的路径。** 本地 SDK `WebviewController.loadData(data,mimeType,encoding,baseUrl,historyUrl)` 与当前 Executor 参数顺序一致；捕获 promise 在 loadData 前建立；pilot 的 Foliate 与 PH76 Web 分支互斥；资源 handler 先经过既有网络政策。Executor 的导航、初始化、页面完成、匹配与清理逻辑没有被本次推测性改写，Host 生产网络政策也没有放宽。早期 runJavaScript 是否可执行、原生跨导航迟到事件是否可能出现，仍是最初两个未决平台问题。

**有限修正。** 仅修改 `app/ArkWebResourceDiagnostic.ts`：params 保留当前生成的精确 HTML；匹配该轮 page URL 时返回该 HTML 内存响应，绝不返回 null 触发真实 HTTP；匹配有限 text/html data 形态且正文与当前 HTML 完全相同才交回 native。编码复用平台 Base64Helper/TextEncoder 与标准 decodeURIComponent，不新增编码算法；任意 data、正文篡改、旧轮次地址/HTML、非受控 HTTP 继续 403。取消后第二任务重新指定当前 HTML；完成/失败/dispose 清除主文档准入。日志增加 documentProvided/documentAllowed/interceptDenied，并使用固定文档种类标签，256 事件上限不变，不输出原始 URL/HTML。当前变化不修改 `ArkWebExecutor.ts` 或 `ArkWebExecutionHost.ets`。

**本地回归（非 native 内核执行）。** `node tools/test-arkweb-resource-diagnostic.mjs` 7 组通过，覆盖当前 raw/percent/base64 HTML、base URL 内存响应、篡改与坏编码、非 HTML data、上轮文档、完成后迟到请求、取消/卸载清理；同时用实际 SDK 编译的 Host `onInterceptRequest` 闭包验证政策先行与 provider 接线，平台网络/响应对象仍由本地替身承担。`node tools/test-arkweb-resource-capture.mjs` 原 19 场景通过，`node tools/test-arkweb-network-policy.mjs` 3 组通过。日志为 `ph76-document-admission-after.log`、`ph76-document-resource-regression.log`、`ph76-document-network-regression.log`。未做 HAP 构建、Git 操作或设备操作。

**后续最小 VM 目的。** Root 在 acbea857 已构建后授权此诊断修正；该旧产物不包含本节变化。新产物只需一次 early 记录，先判主文档为哪种标签、有无 documentAllowed/documentProvided/interceptDenied，再判 CSS/JS native 回调与 matcher；不能沿用旧日志的无标签结论。原始失败保留为 `ph76-vm-early-hilog.log` / `ph76-vm-early-result.json`；同一 hilog 中此前公网搜索失败不是此样本的网络事实。early 有效后再按既定 cancel 样本验证迟到归属，未通过不宣称 PH76 native 验收完成。


## 第二次 VM early 超时：已确认 data 主文档被拒（2026-09-15）

本次为 `20260914T182625Z-6863af5d-ded2e152` 包，受控 runToken `1789411296382-1`。[完整脱敏原日志](ph76-vm-second-data-denied-hilog.log)顺序为 start(1789411296385)、interceptDenied(data-document, 1789411296406)、pageBegin(1789411296426)、pageEnd(1789411296427)、end(1789411300390)，最终 TIMEOUT；没有 resource/intercept/matcher 事件。与第一次无拒绝标签不同，本次已证明主文档经过 provider 并遭拒绝，不能继续把它写成“没有原生拦截回调”。

现有日志没有逗号前的 data 元信息或正文匹配结果，因此还不能确定是 MIME/charset 参数排列、base64/URI 表示、长度限制或正文不一致；也不能据此放行任意 data。当前代码只接受四种明确 text/html 头部及当前正文的 raw/URI/base64 精确匹配。此切片保持 Executor、Host 网络政策和现有准入不变，先补受限形态诊断，以便下一次根任务受控 early 样本确定原生表示。

### 第二次失败后的受限诊断补充（本地冻结，非 native 修复通过）

仅修改 `ArkWebResourceDiagnostic.ts` 及对应 `test-arkweb-resource-diagnostic.mjs`。每个运行中 data 主文档在原判定之前增加 `dataDocumentShape` 事件，仍共享 256 事件上限；达到上限后不再构造此诊断。`isCurrentDataDocument`、Executor 和 Host 网络政策均未改变，没有把未观察过的头部或编码形式加入白名单。

| 字段 | 含义与边界 |
|---|---|
| `metadata` | 仅逗号前、去掉 `data:` 的前 96 个字符；采用 ASCII 白名单。出现白名单外字符或明文/编码 URL 形态时整段记为 `redacted`，不输出其片段；无逗号则为空 |
| `metadataTruncated` / `metadataSanitized` | 只说明截断或脱敏是否发生，不附原始值 |
| `hasComma` / `bodyLength` | 逗号是否存在及其后回调字符串的 UTF-16 长度；不是解码正文的字节数 |
| `hasCurrentDocument` / `withinLengthBound` | 是否有当前轮拥有的主文档，以及是否在原匹配器的长度界限内 |
| `matchesCurrentBody` / `matchesCurrentBase64` | 回调正文是否与当前精确 HTML 或其既有平台 Base64 编码完全相同 |
| `uriDecodeAttempted` / `uriDecodeSucceeded` | 只在当前文档、逗号及长度界限均成立时尝试标准 `decodeURIComponent`，坏编码记录失败，不扩大解码范围 |
| `uriDecodedMatchesCurrentBody` / `uriDecodedMatchesCurrentBase64` | 解码后与当前 HTML/Base64 的相等布尔值；不输出原文、解码内容或原始 URL |

下一次由根任务独占设备执行一个 `early` 样本即可先分辨：当前文档/长度界限是否成立，正文是否属于既有三种表示，以及被拒头部是否与原有限白名单不同。相等布尔值为 true 仍不自动放行；若全为 false，继续从已确定的不一致层查原生表示或正文变化，不能猜测忽略任意前后缀。该诊断本身不能证明 early matcher 或 cancel 归属已通过。

`node tools/test-arkweb-resource-diagnostic.mjs` **8 组 PASS**，日志 [ph76-data-shape-diagnostic-tests.log](ph76-data-shape-diagnostic-tests.log)。新增真实 provider 回归覆盖 raw/URI/Base64 相等、未知头部仍 403、URI 转义 Base64 仍 403、坏编码、超长体不解码、96 字符上限、无逗号不泄露内容，以及正文和嵌入地址不出现在日志。原取消/卸载/旧轮拒绝与实际 SDK Host 政策先行接线继续通过。没有新构建、Git 或设备操作；第二次 VM 超时原件完整保留，当前只达到诊断本地冻结。


## 第三次 VM 精确定位：Base64 正文被原生百分号编码

包 `20260914T185653Z-d5f13a96-803a4b82` 的 early runToken `1789412418166-1` 再次 TIMEOUT。[原始日志](ph76-vm-percent-base64-denied-hilog.log)确证 `metadata=text/html;charset=utf-8;base64`、`bodyLength=312`、当前文档/长度界限均成立，`matchesCurrentBase64=false`，但 `uriDecodeSucceeded=true` 且 `uriDecodedMatchesCurrentBase64=true`；紧接同毫秒发生 interceptDenied，然后才 pageBegin/pageEnd。

因此本次主文档拒绝原因已无歧义：原生回调将当前 Base64 正文做了百分号编码，旧 base64 分支仅直接字符串比较。该证据不包含原始 URL/HTML，也不需要猜测放行其他头部、旧轮次文档或任意 data。当前先最小修正这一精确分支，early matcher 与跨导航归属的 native 结论仍待该主文档可进入后独立验证。

**最小修复已冻结。** `isCurrentDataDocument` 仍先检查原长度界限和两个既有 Base64 元信息值，仍先接受 `body === documentBodyBase64`；仅在直接比较不相等时，使用标准 `decodeURIComponent(body)`，结果必须与当前轮平台生成的 Base64 字符串完全相同。坏 URI 编码返回 false。没有新增 HTML 头部，没有忽略正文前后缀，也没有解码后宽松比较；旧轮次/正文篡改/完成后迟到请求继续拒绝。`ArkWebExecutor.ts` 与 `ArkWebExecutionHost.ets` 未改。

测试将此前“URI 转义 Base64 拒绝”精确改为“当前文档接受”，同时增加篡改、坏编码、错误元信息与旧轮次拒绝，并通过实际 SDK Host 回调验证新形态接线与完成后拒绝。修复前运行失败保留于 [ph76-percent-base64-before.log](ph76-percent-base64-before.log)：provider 的预期接受断言被 runner 捕获后中止了后续形态采样，因此外层首先显示后续形态缺失；原生日志已独立给出准确的拒绝值与匹配布尔值，未把该外层断言当作另一根因。

| 本次定向入口 | 实际结果 |
|---|---|
| `test-arkweb-resource-diagnostic.mjs` | 8 组 PASS；[日志](ph76-percent-base64-after.log) |
| `test-arkweb-resource-capture.mjs` | 原 19 场景 PASS；[日志](ph76-percent-base64-resource-regression.log) |
| `test-arkweb-network-policy.mjs` | 原 3 组 PASS；[日志](ph76-percent-base64-network-regression.log) |

源码、测试与本节证据均冻结。新包仍需根任务的一次有效 early 原生回调观察，再按既定 cancel 场景验证资源归属；本地回归不替代这两个平台结论。本切片没有 Git、构建或设备操作。
