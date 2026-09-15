# af406 搜索：HTTP 空响应与 TypeError 定位缺口

2026-09-15。触发：根任务在保留数据安装的 `af406d49` VM 进行真实搜索，`/private/tmp/reader-proxy-vm-af406-search/reader-network.log` 有 70 条 `Cannot read property length of undefined`（包含 Host/书源重复日志，不能当成 70 个独立请求），另有一次 `platform did not return the requested raw response bytes`。本切片只做代码审计和本地测试，没有操作设备、构建或改 Native。

## 已定位及未定位

`HttpExecuteHost.singleHopTransport` 要求 `expectDataType=ARRAY_BUFFER`，随后只接受 ArrayBuffer 或已截停的重定向。因而 HEAD/204/205/304 的 null/undefined/空字符串以及 200 空字符串会被判为缺失原始字节。[本地修前失败](ph92-http-empty-before.log)通过真实单跳方法复现该遗漏。

这符合 SDK 的响应声明边界：`@ohos.net.http.d.ts` 将 result 定义为 string/Object/ArrayBuffer，expectDataType 是优先返回类型；空值兼容仍应按具体 HTTP 语义限制。[RFC 9110 §6.4.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-6.4.1)规定 HEAD、204、304 不带正文，[§15.3.6](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.6)规定 205 不产生正文。

真实 raw-bytes 错误缺少状态/返回类型，不能直接断言就是上述空值之一。大量 length/undefined 的根因也尚未确认：根任务审计 Native GetStringValue/EncodeText 尚未证明空输入编码会返回 undefined，本切片不修改编码方法、不把异常吞成空字节。

## 最小修复

- ArrayBuffer 仍原样读取，保留二进制及原编码字节。
- 空字符串严格对应零字节，不重新编码。
- null/undefined 仅在 HEAD 或 204/205/304 时对应零字节；HEAD/304 的 Content-Length 可以描述 GET 表示，不能以该头要求有正文。
- 普通 200 的 null/undefined、非空已解码字符串、任意对象、数字和 typed-array 仍失败。错误仅增加受限 HTTP 状态码与固定 JavaScript 类型，不输出正文/URL/响应头。
- 原重定向截停逻辑不变；Location 仍流向原逐跳 method/header/cookie/目标准入流程，不允许空响应绕过私网限制。
- TypeError 定位在单跳固定阶段和最终 `request.chain` 异常处输出，覆盖请求体、原生请求、响应处理以及单跳之外的 CookieSessionStore 路径。仅提取 HttpExecuteHost/CookieSessionStore/NetworkRoutePolicy 的 ts/ets 文件名及最多 7 位行列数字；无匹配输出 no-frame。原始栈最多检查前 8192 字符，从不输出原始栈/消息/路径/URL；同阶段同帧去重，整个进程最多 16 项，保留原异常及 request 清理。

## 本地证据与后续范围

[修后单跳回归](ph92-http-empty-after.log)全部通过：22 个合法空响应/二进制样本；6 个缺失/非原始字节类型拒绝；5 种重定向到私网均在第二跳之前拒绝；最终 response 转换得到空正文；请求体/原生请求/响应头及外层 cookie TypeError 保留原异常、正确分段、去重、无敏感输出且上限 16。该测试自动纳入既有 `scripts/check-local.sh` 的 test-*.mjs 发现流程。

既有 HTTP conformance 23 个固定向量通过；NetworkRoutePolicy 的代理、PAC DIRECT、DNS pin、取消 lease 与 SDK 错误透传回归通过。日志分别为 [conformance](ph92-http-empty-conformance.log)、[network](ph92-http-empty-network.log)。

代码修复与本地回归已完成。下一次根任务原定真实查询若仍发生 length 错误，应读取新增 TypeError stage/frame，先按具体代码位置定位；若 raw-bytes 错误仍有，应按新增 status/type 区分已解码非空响应或其他平台结果。不能将本次空响应修复宣称为所有搜索失败已闭环，HAP/VM/用户验收仍由后续独立证据决定。

## 6cf9705d 新包：UTF-8 编码链已准确定位并修复

根任务的新查询日志 `/private/tmp/reader-proxy-vm-6cf-search/reader-network.log` 已给出精确位置：`request.payload / HttpExecuteHost.ts:878:65`，对应 `new util.TextEncoder('utf-8').encode(text).length`。因此该批 length 异常的实际原因是平台编码调用结果不能按预期读取长度，不能继续归因于 Core NAPI。另一错误也已补齐为 `status=403, type=undefined`。受限原日志保留在 [ph92-http-6cf-located.log](ph92-http-6cf-located.log)。

当前修复统一使用已引入的 `encodeSharedText`：UTF-8 与 GBK 等原始文本请求都得到同一共享编码器的 ArrayBuffer，以原 16 MiB **字节**上限编码并直接发送，不再次依赖平台 HTTP 编码。表单百分号编码后的最终 ASCII 拼接也走共享编码；multipart 的文本块同步移除相同旧平台 API 分支，原合并总限额与二进制块逻辑不变。没有新增编码表、解析器或 Native 生产变更。

已知 HTTP 4xx/5xx 若正文缺失，明确报 `source returned HTTP <status> without response content`，保留源站拒绝/错误语义；不会转为正常空正文，不归类为系统网络故障。实际含原始 ArrayBuffer 正文的 403 保持原行为交给 Core。正常 200 的 undefined/null 仍拒绝，前述合法 HEAD/204/205/304 和空字符串分支不变。

原生 `request()` 异常现在保留安全 numeric code 诊断：数字或最多 15 位数字字符串可归一化，固定输出 `phase=transport stage=request.dispatch code=<number>`。与 TypeError 共用同一个进程内最多 16 项、去重后的诊断集合；不输出原生 message、URL、头或正文。proxy 错误的数字字符串也按原数字规则分类；其余错误继续抛出原异常，不把源站/TLS/SDK 问题一律归为环境问题。

验证：[修前真实 payload 回归](ph92-http-shared-encode-before.log)在同一 `.encode(text).length` 崩溃；[修后 Native 回归](ph92-http-shared-encode-native-after.log)通过实际 SDK wrapper + 既有 C++ NAPI/Rust 编码模块（Node，不是 VM），覆盖空 POST、中文 UTF-8/UTF8、空/非空 GBK、空/普通/中文/GBK 表单、精确 16 MiB、超过限额及中文按字节超限、multipart。平台 TextEncoder 在测试中固定返回 undefined，证明生产链不再依赖它。[常规回归](ph92-http-shared-encode-fixture-after.log)以同一 SDK wrapper 和固定 UTF-8/GBK 编码样本自动加入全量脚本门禁；Native 变体可用 `READER_NATIVE_ENCODER` 指向现有探针模块独立运行。

[响应/诊断回归](ph92-http-6cf-response-after.log)全过，新增 12 个 4xx/5xx 缺正文拒绝及实际 403 原始正文保留，验证 native 数字/数字字符串归一去重、恶意字符串不输出、原异常身份不变及与 TypeError 共用 16 项上限。既有 HTTP 23 向量、NetworkRoutePolicy、WebDAV、source product tools、portable import 定向回归均通过。本切片仍未操作 VM；新的真实搜索用于验证已修复编码链，并利用受限错误码区分其余 Internal error，不能仅以本地通过宣称全部书源可用。
