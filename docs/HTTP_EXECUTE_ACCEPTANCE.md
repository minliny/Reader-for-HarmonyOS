# `http.execute` Host 验收（真机/模拟器）

记录日期：2026-08-05
状态：**PARTIAL**——adapter 已实现并 `assembleHap` 通过（未签名 HAP），但**真实联网、重定向、PROPFIND、deadline 行为均未在设备验证**。本文件是真机到位后执行的验收清单；判定口径已固定，执行时只填结果，不改标准。

## 0. 前置

- 源码当前 `assembleHap` 成功，产物为**未签名 HAP**：安装需签名或开发者模式授权。
- 测试服务器：`tools/http-execute-test-server.js`（Node，无需依赖）。在局域网一台机器运行：
  ```bash
  node tools/http-execute-test-server.js 8000
  ```
  记录其 stdout（每请求 `REQ <METHOD> <URL> ...`、断开 `RES_CLOSE ... finished=false`）。设备与服务器同网段，记服务器局域网 IP 为 `<SRV>`。
- 本机 curl 冒烟示例（**带 `?` 的 URL 必须加引号**，否则 zsh 会当 glob）：
  ```bash
  curl -s "http://127.0.0.1:8000/redirect-depth?n=3"
  ```
- 触发 `http.execute`：任一 Core 网络命令路径（`book.search` / `source.check.run` / `rss.subscription.refresh`）。若该命令尚未从 UI 接线，用临时最小测试入口 `runtime.request(cmd, params)` 触发（同一 Host capability 路径）。测试书源 `searchUrl` 指向 `<SRV>` 的相应端点。
- 观测：服务器 stdout（到达线）＋ App hilog 的 Host `host.complete`/`host.error`（SDK 层路由）＋ Core 后续结果/错误。

## 1. 验收项

### 项 0（deadline 前置）：延迟端点超过预算后必须真正取消

- 触发：`/slow?ms=40000`（40s > Host 25s deadline），书源/测试命令显式 `retry.maxAttempts: 5`（确保超时后若有后台重试会被服务器观测到）。
- **通过**：
  1. 约 25s 收到 `host.error`（非 200）；
  2. 服务器只看到**一次** `REQ /slow`，且随后有 `RES_CLOSE ... finished=false`——连接在响应前被 Host 关闭（`destroy()` 真取消在途请求）；
  3. 服务器在断开后**不再收到任何重试请求**（即便 `maxAttempts:5` 也未触发）。
- 失败模式：若服务端收到第 2/N 次请求、或 40s 时 200 仍成功送达（`finished=true`），说明取消或后台重试抑制仍失效，需修复。

### 项 1：`followRedirects` 省略（Host 受控默认 10）

- 触发 A：书源 `searchUrl` 指向 `/redirect`（302 → `/final`），不显式传 `followRedirects`/`maxRedirects`。
- 预期契约：Host 把省略映射为受控上限 **10**（`DEFAULT_MAX_REDIRECTS`），不是平台无界默认。
- **通过 A**：跟随到 `/final` 的 200 正文（服务器日志看到 302 然后 200）；若平台不跟随，必须返回 30x 与 `Location`，**不得因 adapter 拒绝而失败**。
- 触发 B（证明默认上限确实是 10，而非"仅能跟随一次"）：省略字段下指向 `/redirect-depth?n=11`（或 `/redirect-loop`）。
- **通过 B**：服务器日志的 302 跳数**不超过 10**；11 跳场景必须在第 10 跳后停止（返回 30x 或 `host.error`），**不得越过上限取到最终 200**。
- 仅触发 A 无法区分默认上限 1 / 10 / 20 / 无限；A+B 合起来才证明 `DEFAULT_MAX_REDIRECTS=10` 生效。

### 项 2：`followRedirects:false`

- 触发：源配置 `followRedirects:false`，URL 指向 `/redirect`。
- **通过**：拿到 302 和 `Location` 头，**不自动跟随**（服务器只看到一次 `/redirect` 请求，无 `/final` 请求）。
- 否则 `java.get` 等需要观察 30x 的链路不成立。

### 项 3：`true + maxRedirects:10`

- 触发 A：`/redirect-depth?n=3` → 应 3 跳后到 `/final` 200，正文为 `/final` 内容。
- 触发 B：`/redirect-loop`（无限）或 `/redirect-depth?n=11` → **不得越过上限取到最终正文**；应在上限处停止（30x 或 host.error），服务器日志跳数有限。
- **通过**：A 到 200；B 不越上限。

### 项 4：`finalUrl` / 相对链接（**已知未闭合**）

- 触发：先 `/redirect`（到 `/final`），`/final` 正文含**相对链接** `href="relative/next.html"`；Core 解析后续链接。
- 预期当前：**未闭合**。记录：相对链接被解析到错误基址（请求 URL 而非最终 URL），或 Core 安全停止后续解析。
- **只有** Host 能给出真实最终 URL（平台 `HttpResponse` 无此字段，需自定义方案），**或** Core 安全停止解析，才可关闭此项。不得伪造 finalUrl。

### 项 5：`PROPFIND`（仅证明 transport）

- 触发：书源/测试入口发起 `customMethod: "PROPFIND"` 到 `/propfind`。
- **通过**：服务器日志观测到精确方法 `PROPFIND`；Host `host.complete` 回传状态 207、头、正文。
- 只证明 customMethod transport 走通；**不证明备份编排完成**（`sync.backup`/`webdav.plan` 仍为纯计划器，属独立工作项）。

### 项 6：请求体与附件安全边界

| 用例 | 通过标准 |
|---|---|
| UTF-8 Raw 请求体 | `/echo` 回显字节与发送一致（base64 对比） |
| UTF-8 Form | `/echo` 收到 urlencoded body，Content-Type 含 charset |
| GBK/Big5 请求 charset | **未发出任何网络请求**即明确失败（服务器日志无 REQ）；Host `host.error` 说明不支持 |
| Multipart 内联 `data:[0,1,255]` | `/echo` 收到的 multipart body 中该文件字节原样为 `[0,1,255]` |
| Multipart 仅 `filePath` | **必须失败且服务器无请求**（filePath 未授权，安全拒绝） |

## 2. 记录模板

| 项 | 触发命令/源 | 服务器观测 | Host host.complete/error | Core 后续 | 判定 | 备注 |
|---|---|---|---|---|---|---|
| 0 deadline | | | | | 通过/失败 | |
| 1 省略 | | | | | 记录平台行为 | |
| 2 false | | | | | 通过/失败 | |
| 3 true+10 | | | | | 通过/失败 | |
| 4 finalUrl | | | | | 未闭合 | |
| 5 PROPFIND | | | | | 通过/失败 | |
| 6 body/附件 | | | | | 通过/失败 | |

## 3. 已知未闭合（不允许伪闭合）

- **finalUrl**：平台 `HttpResponse` 无最终 URL 字段；Core 用它解析重定向后相对链接（remote.rs:1447）。需自定义"保留 Location 的手动重定向链"或 Core 安全停止解析。
- **`followRedirects:false` 的平台行为**：当前 `maxRedirects:0` 是否真返回 30x 未验证。
- **filePath**：安全拒绝（无用户授权附件句柄→受限路径映射），不是"已支持"。
- **cookie jar / session**：fail-closed，未实现。
