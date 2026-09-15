# Reader 代理平台适配只读审计（2026-09-15）

范围：当前 Harmony 源码、已安装 DevEco SDK API 声明及 OpenHarmony 官方文档/源码。未读取用户真实代理、VPN、订阅配置；未 HDC；未编辑生产。

## 结论

当前统一 HTTP Host 把“系统 DNS 返回的地址”直接视为最终目标地址，在发请求之前做公网准入，再写入应用级 DNS pin。它没有代理路由上下文。Fake-IP 代理把合法域名映射到保留地址时会在网络请求前被拒绝，这个兼容缺口有直接代码依据。

**不能把未设置 usingProxy 直接定性为没有代理支持。** 已安装 SDK 对缺省值未给确定描述；官方当前参数表和 NetStack 构造器支持默认系统代理，而同一文档旧示例仍写默认 false。必须明确设置/验证当前目标系统语义，不能引用旧示例作最终结论。

## 当前代码证据

`Reader-for-HarmonyOS/entry/src/main/ets/app/HttpExecuteHost.ts`：
- 476：入口先 `rejectPrivateNetworkTarget`。
- 573：每个重定向也先准入。
- 610–641：域名按 host 串行持有应用级 DNS pin；再次 resolve/validate，`addCustomDnsRule(hostname, addresses)`，结束移除。
- 670–691：HttpRequestOptions 未显式设置 usingProxy。
- 966–1004：系统 `getAddressesByName(host)`；任何地址为空/非法/非公网即整次拒绝。987–989 注释称本地 DNS 失败后请求必然失败，这对“代理解析远端域名”的 HTTP 代理模式不成立。
- 项目没有使用 getDefaultHttpProxy/getAllNets/BEARER_VPN；当前 GET_NETWORK_INFO 已在 `entry/src/main/module.json5:19` 声明。
- `build-profile.json5:6–7` 最低和目标均 API 23，不能把 API 24 返回信息当现有设备能力。

## SDK 能看见什么、不能证明什么

以下均来自 `/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/api/`。

| API | 证据 | 可支持的判断 | 不能推出的结论 |
|---|---|---|---|
| http.HttpRequestOptions.usingProxy | @ohos.net.http.d.ts:329–358，API 10 | true 指定系统代理，false 指定不采用 HTTP 代理，对象指定代理 | false 不能绕过 VPN；遗漏字段不能据此确定目标 OS 的默认行为 |
| connection.getDefaultHttpProxy | @ohos.net.connection.d.ts:683–711，API 10 | 取应用、全局、进程绑定网络、默认网络优先链得到的有效 HTTP 代理配置 | 有配置不等于该 URL 会走代理，可能命中 exclusionList/PAC DIRECT；不含 TUN Fake-IP 语义 |
| getAllNets + getNetCapabilities | :201–233、:278–368、:1819–1873、:2089，API 8+ | 活跃网络及 bearerTypes 是否报告 VPN | 任意 VPN 存在不等于本应用/该目标走 VPN；VPN 不证明某个 198.18 地址是合成地址，也不证明恢复后的实际 IP 为公网 |
| getConnectionProperties | :238–278、:2123–2165，API 8 | interfaceName、dnses、routes、linkAddresses | DNS 服务器地址、接口名称、路由不能证明域名的 Fake-IP 映射或真实最终地址 |
| getDefaultNet / NetHandle.getAddressesByName | :160–196、:1701–1752 | 指定网络的 DNS 观察可减少网络选择歧义 | 仍无法区分恶意 DNS 指向私网与 VPN 合成映射；不能为绕开 VPN而自动 setAppNet |
| getPacUrl / getPacFileUrl / findProxyForUrl | :735–770，后两者 API 20 | per-URL PAC 结果可区分 DIRECT 与 PROXY 类型；需处理 SDK 错误及受支持协议 | 仅凭 HTTP proxy host 非空不能忽略 PAC/排除；不能自己实现 PAC JS 解释器 |
| addCustomDnsRule/removeCustomDnsRule | :771–886，API 11 | 当前应用的 host→IP 映射；项目必须保证 lease 清理 | 不保证远端 HTTP 代理会使用此映射；它是应用级而非单 request scope |
| http.response.connectionExtraInfo.remoteAddress | @ohos.net.http.d.ts:4370–4376，API 24 | 在较新平台观察实际连接的对端 | API 23 不可依赖；代理时可能是代理对端而非源站；回包后检查也不能避免已发出的敏感请求 |

`HttpProxy` 有 host/port/username/password/exclusionList（:2367–2439）；诊断只保留“存在/模式/错误阶段”，不要输出具体配置和凭据。

## 官方缺省值证据及冲突

- 官方参数表 `usingProxy` 写缺省系统代理，true 系统代理、false 不使用、对象使用指定配置： https://github.com/openharmony/docs/blob/master/en/application-dev/reference/apis-network-kit/js-apis-http.md#httprequestoptions （当前 raw 行 1231）。
- 同页示例 raw 行 53/333 保留旧的默认 false 注释，与参数表不一致，不能据此下定论。
- 当前官方 NetStack `HttpRequestOptions::HttpRequestOptions` 第 40 行 `usingHttpProxyType_(UsingHttpProxyType::USE_DEFAULT)`： https://github.com/openharmony/communication_netstack/blob/master/frameworks/js/napi/http/options/src/http_request_options.cpp#L31-L40 。这是上游现状证据，不冒充用户 HarmonyOS 固件二进制的验证。

## 最小修复建议与安全边界

1. 拆分“目标 URL 准入”和“传输路由选择”：literal 私网/loopback/link-local/本地保留名称继续拒绝，逐跳 redirect、协议、敏感 header、TLS校验保持；引入明确 direct/system HTTP proxy/VPN-present-unknown/unknown 的路由诊断。系统模式应显式 `usingProxy:true`，并处理 PAC、排除列表、网络变更；**单加 true 不会修复前置 Fake-IP 拒绝**。
2. 本地 DNS 的保留地址必须分类为“解析结果不适配当前路由”，不能计为所有书源的解析失败/失效，不能缓存为候选永久坏源。诊断记录 source hash、request stage、DNS 地址类别、effective proxy present、VPN indication、transport reached、generation；不记 URL query、代理地址、认证或订阅。
3. Direct 路径保留当前验证+pin。HTTP 代理路径不能声称本地 DNS pin 约束了代理端的 DNS。要么明确由可信系统代理承担目的地路由及访问边界，作为受限传输信任模型（需要项目安全约束同意），要么采用能固定最终公网目的地址、同时保留原 Host/TLS SNI/证书校验的成熟平台/上游传输能力。当前 ArkTS SDK 没发现 per-request connect-to IP 选项；只替换 URL IP + sniHostName 的证书验证语义未经证实，不能直接交付。
4. TUN/Fake-IP 的自动兼容需要可验证的目的地址来源或受信代理映射能力。`VPN=true && dns=198.18/15` **不充分**；同样条件下恶意域名也能返回私网/保留地址，VPN存在和实际映射真假互不等价。不能做 VPN 存在就全面放行、不能把198.18/15从通用私网策略删掉、不能静默选非VPN网络或更改系统DNS。
5. 若采用独立可信解析得到公网IP并固定传输，需要把解析器选择、隐私、HTTP代理端远程解析语义和DNS重绑定防护一起评估；不能随手硬编码第三方DNS。只在遇到冲突时给出准确错误提示不是功能完整闭环，必须在报告保留兼容缺口。
6. 回归矩阵：direct public；direct→private redirect；系统HTTP代理且本地DNS失败；排除列表/PAC DIRECT；纯VPN真实DNS；VPN Fake-IP；同VPN恶意保留DNS；代理切换中取消/重试/DNS lease；完整搜索→detail→TOC→body；网络环境失败不得写永久源失败事实。可用本地mock/受控代理先测；只有目标系统原生路由默认/映射语义无法靠代码确认时才安排最小设备取证。

最终边界：API足以检测 HTTP代理设置和VPN指示，**不足以从检测结果安全证明 Fake-IP→真实公网地址映射**。当前项目可以立即修正错误分类、路由上下文、明确系统HTTP代理语义和受控回归；不能宣称任何网络代理全量兼容已由一个判断修好。
