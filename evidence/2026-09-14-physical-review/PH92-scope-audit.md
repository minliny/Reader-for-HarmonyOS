# Reader 代理全书源不可用：只读范围审计（2026-09-15）

## 结论与证据界限

当前生产网络前置准入确实与 fake-IP 代理模式存在不兼容：域名通过系统 DNS 解析为 198.18/15 后，Reader 在实际 HTTP 请求发生前拒绝；ArkWeb 也拒绝。最后有真机回执的 1d1f47e5 与最新 VM 基线 3843792a 的 HttpExecuteHost.ts / HttpTransportPolicy.ts / ArkWebExecutor.ts **git diff 为空**，因此后续 VM 包未修复这一代理问题。当前未提交 ArkWeb 改动是任务隔离，相关 DNS 逻辑仍相同。

本轮没有接触真机、读取代理配置或新扫书源。不能把“所有代理都会失败”定成代码事实，也不能宣布用户手机此次已确证使用 fake-IP。正常公网 DNS 答案仍可通过；HTTP 显式代理、VPN/TUN 代理、fake-IP 必须分开判断。

## 精确调用链（Harmony 当前源码行号）

根路径 `/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/`。

- `entry/src/main/ets/app/ReaderHostRegistry.ts:205–208` 将 Core `http.execute` 统一转发 HttpExecuteHost。
- `app/HttpExecuteHost.ts:475–478` 首次请求前 `rejectPrivateNetworkTarget`；`:573` 每个重定向再准入。
- `app/HttpExecuteHost.ts:985` 系统 `connection.getAddressesByName(host)`；`:994–1002` 只要任一答案非公网就整次拒绝，包括“公网+fake-IP”混合答案。
- `app/HttpTransportPolicy.ts:224–237` 公共 IPv4 字节规则，`:234` 明确拒绝 198.18 与 198.19。
- `app/HttpExecuteHost.ts:625–630` 仅通过后才 `addCustomDnsRule` 并进入传输。故单独设置 `usingProxy: true` 不能消除前置拒绝。
- `app/HttpExecuteHost.ts:672–694` 实际 HttpRequestOptions 未配置 `usingProxy`；当前工程未检出 `getDefaultHttpProxy`、VPN 检测或代理准入分支。不能凭“未配置”直接断言平台默认禁用代理，本地声明未给默认值。
- `app/ArkWebExecutor.ts:220–240` 同样系统预解析、公共地址判定后才 setHostIP。`:204–217` 子资源要求同主域；更换为 WebView 路线也无法绕过主域 fake-IP 拒绝。

## 影响范围

| 功能 | 同一拒绝链 | 当前证据 |
|---|---|---|
| 搜索/详情/目录/正文/下载 HTTP | 是 | ReaderHostRegistry.ts:205；所有 Core http.execute 共用 |
| ArkWeb 书源及登录网页 | 相同字节规则，独立预检 | ArkWebExecutor.ts:220–240 |
| HTTP TTS 音频 | 是 | HarmonyHttpTtsHost.ts:259–275；系统 TTS 本身不是此路径 |
| 阅读正文网络图片 | 是 | ReadingBodyImageHost.ts:72–76 |
| 在线 JSON 书源导入 | 是 | ReaderHostRegistry.ts:325–335 |
| WebDAV 同步请求 | 是 | features/sync/SyncGateway.ts:368 |
| 书架/详情封面 | **不是**统一 Host 抓取 | features/bookshelf/BookshelfPage.ets:396、847；LocalBookDetail.ets:146 直接 ArkUI Image(URL)。封面是否可用需单独证据，不能扩展宣称全应用所有网络共用门禁。 |

## 已有错误诊断不足

`HttpExecuteHost.ts:384–402` 脱敏诊断只区分取消、超时、解码、重定向等，地址准入落到统一“Host 网络请求失败”。普通源请求又不带 source.check 的 diagnostic 元数据（Core `crates/reader-contract/src/remote.rs:732–736`）。错误不是按代理/DNS/非公网独立结构化输出；源列表容易呈现为逐源故障。

已有 VM 证据在 `evidence/2026-09-14-physical-review/search-flow-implementation/IMPLEMENTATION.md:167–175`：109 源失败中 106 次地址准入、3 次 searchUrl 为空；仅确认 www.zongheng.com 解析 198.18.0.189。既有生产方法离线探针已拒绝 198.18、198.19、内网和混合答案，并接受纯公网。此证据可解释该 VM，不能替代手机样本。

## 可复用能力与薄适配边界

1. 当前已用系统 OpenHarmony NetStack `@ohos.net.http` 和 NetManager `@ohos.net.connection`，不需要新造 HTTP 或 DNS 引擎。
2. 本机 SDK `/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/api/@ohos.net.http.d.ts:334–358` 提供 `usingProxy?: boolean | HttpProxy`；`:335–336` 明确可使用系统默认代理或给定代理。声明未给省略时默认行为，需以官方 API/系统实现核验，不能猜。
3. 同 SDK `@ohos.net.connection.d.ts:683–711` 提供 `getDefaultHttpProxy`，依次返回应用、全局、绑定网络或默认网络的 HTTP 代理；这不等于识别所有 VPN/TUN fake-IP。
4. Core `crates/reader-contract/src/remote.rs:737–771` 的 HostHttpRequest 无代理字段，并 deny_unknown_fields。代理选择属于 Host 的受信任网络配置，不能让外部书源描述符自带任意放行标识。
5. 已有 ureq 2.12.1（`Reader-Core-Native/Cargo.lock:1928–1942`，Apache/MIT 上游）在 `tools/reader-cli/Cargo.toml:19` 用于 CLI，具备 Proxy 支持；它**不是当前 Harmony 生产网络栈**。引入它不能自动解决系统 VPN、WebView 同路由、权限和既有 SSRF 约束，不能把它当完整替代结论。
6. 必要 Reader 适配是：识别可信系统路由上下文，区分 URL 指向内网与代理合成目的地址；对直连、系统 HTTP 代理、VPN/fake-IP 定义明确准入与失效回退；HTTP/WebView 同一规则；保留 Host/TLS/跳转约束；网络切换时撤销旧租约；输出可区分的公共错误。不能全局放行 198.18/15，也不能只因系统有 VPN 就允许任意内网目标。

建议验证矩阵：直连公网、系统 HTTP 代理（含 excludeList）、TUN+真实IP、TUN+fakeIP、混合 DNS、公网到内网重定向、代理开启/关闭中的请求、HTTP/ArkWeb/TTS/正文图片四条实通路。先本地模拟真实生产方法，再最小代理设备验证；没有代理参数或机型尚不妨碍先补齐代码定位与矩阵。
