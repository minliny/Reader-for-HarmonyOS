# c56 实搜 HTTP 余项与 URL 边界修复

## 证据范围

- 原包 `c56ad545`；原 VM 进程 `2810`；既有日志 `/private/tmp/reader-proxy-vm-c56-search/reader-network.log`，14:48:18–14:49:18。本文只读既有日志并运行本地生产方法探针，没有操作设备。
- 该日志无 `length of undefined`、TypeError 或 `requested raw response bytes`。HTTP 400/403 缺失响应体已保留 HTTP 拒绝语义。没有把源拒绝转换为成功正文。
- 日志有 16 条 `Search source ... failed`；30.685 秒 UI 采样的 8 个失败只是较早快照，不能混为最终计数。上一包含大量提前编码失败，两轮耗时不能直接对比为提速。
- 这份修复的本地测试通过不代表新的 ArkTS 构建、安装或 VM 行为通过。

## 余项分类

| 类型 | 本轮证据 | 结论与边界 |
| --- | --- | --- |
| `2300999` / Internal error | 首条与 101kanshu.net 相邻；另有 novel.seseclub.com、sesebooks.com、www.hqrgjtcw.com、www.xtyxsw.org、www.souhh.com 共 6 条源失败 | 平台映射汇总错误。后续同文案不能自动绑定到同一底层错误；code 按进程去重。不能据此判定这些源永久失效。 |
| `2300023` | 14:48:20.871，一条 native 诊断，无紧邻源失败 | 平台接收写回失败，也可由取消 destroy 触发；日志不能证明本次是哪一种。REDIRECTION false 上游走完成响应，并非主动 destroy。 |
| `2300003` | 14:48:21.173；无源身份关联 | 地址格式拒绝。代码确认规范化缺口，但不能把实际“鸣龙”这次错误归因到该缺口或具体源。 |
| `2300052` | w2.heiyan.com | 没收到响应头/数据，不能当作合法 HTTP 空正文成功。 |
| `2300060` | www.liyuxiangku.com | TLS 对端身份验证失败；保留校验，不关闭证书验证。 |
| HTTP 400/403 | bcshuku.com / www.min-yuan.com | 源请求被拒绝，保留状态；400 的请求适配因素仍待核实，不能仅据状态宣布源损坏。 |
| 空搜索地址 | qd9.net、ruarourou.top、www.zggdwx.com | 构造请求前终止，与 native URL 格式错误不同。 |
| 空书名 | 444.1006sd.com、m.zjsw.org；www.52dzxy.com 另丢弃 23 行 | 结果准入失败，不能把无标题行渲染为正常书籍。 |
| 地址准入 | www.tatays.com | 受保护地址被拒绝；此记录不包含足以进一步判断规则/跳转/网络地址来源的证据，不能放宽准入。 |

根任务读取了同 PID、同时间段现存 W/E 和全部级别平台日志：没有 NetStack/http 或 CURL 细码。没有用新搜索重复替代代码审计，也没有把 `2300999` 一律标坏源。

官方对照：[HTTP 错误码](https://raw.githubusercontent.com/openharmony/docs/master/en/application-dev/reference/apis-network-kit/errorcode-net-http.md)、[RequestContext 错误映射](https://raw.githubusercontent.com/openharmony/communication_netstack/master/frameworks/js/napi/http/async_context/src/request_context.cpp)、[接收及 CURL 结果处理](https://raw.githubusercontent.com/openharmony/communication_netstack/master/frameworks/js/napi/http/http_exec/src/http_exec.cpp)、[重定向拦截器完成分支](https://raw.githubusercontent.com/openharmony/communication_netstack/master/frameworks/js/napi/http/http_interceptor/src/http_interceptor.cpp)。上游用于核对平台语义，不声称 VM 二进制与 master 完全一致。

## 已定位并修复

1. `execute()` 解析 URL 只用于验证，随后准入、cookie 和 native request 继续使用原始字符串。源 JS `java.get/ajax` 不一定经过普通 `{{key}}` 的编码步骤。
2. 当前 bundled `bcshuku.com`（数组索引 658、`corpus-4c2f678fcf9d`）真实脚本直接拼接原始 `key`。本地执行原规则且完全模拟 java.get：`鸣 龙` 产生原始空格，libcurl 仅解析返回格式错误 3；平台 URL 序列化后可解析。`鸣龙` 没有空格，本机 libcurl 可解析，所以不将该次错误归因于“中文必然非法”。`101kanshu.net` 自行 encodeURIComponent 的 POST 参数已排除这一同类模板缺口。
3. 修复复用 `@ohos.url` 的 `URL.parseURL(...).toString()`，入口实际使用返回值。准入、DNS 绑定、cookie、传输及 finalUrl 共用同一规范化地址；重定向也返回同一校验/序列化结果。已有 `%D6%D0` 等源选择的 GBK 转义、`%2520`、query 分隔符和 fragment 不额外解码或二次编码。
4. 回归发现相邻缺陷：跨域重定向仍携带旧显式 `Host`。仅在跨域分支删除该请求头，让系统按新地址生成 authority；首跳及同域自定义 `Host` 保留。方法及正文遵循已有 301/302/303/307/308 规则。

## 验证

- `tools/test-http-url-normalization.mjs` 调用实际 `execute → requestWithPolicy → requestRedirectChain → singleHop → singleHopTransport`，验证 URL、cookie、DNS、请求参数、finalUrl 和拒绝边界，平台网络完全模拟。
- 修前以 `c56ad545` 生产文件运行同一个探针：native 边界拒绝原始空格；修后通过。URL API 在本地替身为 Node WHATWG URL，尚需原生平台确认序列化一致性。
- 覆盖中文/空格、已有 GBK 百分号字节、query/fragment、默认端口/大小写、307 POST 正文保留、同域 Host 保留、跨域 Host/敏感头清理、十六进制/整数/短写 loopback 及重定向准入。
- 既有 payload、空响应/错误诊断、23 向量 HTTP conformance、网络选路/取消/DNS 租约回归全部通过。未修改 Core、源脚本或请求方法/body 解释规则。
- `2300999`、此次 `2300003` 的源身份与底层原因、`2300023` 的取消归属仍未由现存证据证明；这些边界保留，不能作为本次 URL 修复已覆盖的个案。
