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
