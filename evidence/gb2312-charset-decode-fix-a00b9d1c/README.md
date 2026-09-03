# gb2312 源响应解码修复 — 证据包

日期：2026-08-30 ｜ 分支提交：见 worktree 分支 `fix/gb2312-charset-decode`（基点 6547053）

## 1. 问题与根因

65 源库中 4 个源声明 `charset: gb2312`（yqk.net http/https 两条 URL、yqxz.org、sjks88.com）。
HarmonyOS `util.TextDecoder` 支持 gbk/gb18030/big5，**不支持 `gb2312` 标签**：
`TextDecoder.create('gb2312')` 直接抛 "Parameter error"，fail-closed Host 整个源死亡。

基线 hilog（修复前 HAP，同一 VM 同一数据，04:29）实锤：

```
Search source http://www.yqk.net failed: http.execute: cannot decode response as gb2312: Parameter error. Please check if the decode data matches the encoding format.
Search source https://www.yqk.net failed: (同上)
```

宿主机 curl 佐证因果链：`https://www.yqk.net/` HTTP 200 在线，页面 `<meta charset=gb2312>`、
响应头 `content-type: text/html`（无 charset → 应用走 Core descriptor `gb2312` 路径）；
响应体在 **gbk 严格解码下无损**（gbk 是 gb2312 的字节级超集）。

## 2. 修复内容（3 文件）

- `entry/src/main/ets/app/HttpTransportPolicy.ts`：新增 `normalizeCharsetLabel()` —
  `gb2312 → gbk` 别名归一（无损超集映射），其余标签 trim 透传；
  `resolveResponseCharset()` 的 header 路径与 descriptor 路径均过归一。
- `entry/src/main/ets/app/HttpExecuteHost.ts`：新增 `decodeTextStrictly()` 多候选严格解码 —
  候选 [响应 charset, Core descriptor charset, utf-8, gbk]，逐个 `fatal: true` 尝试，
  全部失败才抛（含各候选失败原因）。任一候选成功即返回，fail-closed 语义不变。
- `tools/test-http-transport-conformance.mjs`：合同测试同步
  （gb2312 向量走 gbk 解码 + 5 条新断言：归一函数行为、header/descriptor 双路径归一、Host 源形状）。

## 3. 合同与构建

- 12 套合同测试全 PASS（Node 24，`stripTypeScriptTypes`）：
  http-transport-conformance（23 向量, vectorSha `ad87a542…5c331` 不变）、portable-json-import、
  source-product-tools、search-gateway、search-orchestrator、remote-reading-flow-gateway/runtime、
  bookshelf-detail-removal、reading-session-routing、sync-webdav-product、
  reading-pagination-integration、book-source-import。
- HAP：`entry-default-signed.hap`，SHA256
  `a00b9d1caed8c184e588eb32a1c797d5e153c1970239bdd977e56c3effdf5066`（131,070,119 B）。
- 构建：DevEco 内置 hvigor + `DEVECO_SDK_HOME=/Applications/DevEco-Studio.app/Contents/sdk`，BUILD SUCCESSFUL。

## 4. VM A/B 实证（127.0.0.1:5555，install -r 保留数据）

方法：同一 VM、同一 65 源库存数据，仅换 HAP，搜索单词触发全源扇出，
对比编排器失败日志（每个源级错误必落一行 `Search source <url> failed`）。

| | 修复前（04:29 基线） | 修复后（总裁 / 豪门 两次搜索） |
|---|---|---|
| 失败源 URL 数 | 40 | 39 / 39 |
| yqk.net (http+https) | **两条均在失败集（gb2312 解码错误）** | **两条均不在失败集**（两次搜索一致） |
| `cannot decode` 行数 | 2（即 yqk 两条） | **0** |
| 恢复的源 | — | 恰好 = 两条 gb2312 声明的 yqk 端点 |

失败集差异全量核对（`comm` 双向）：
- 恢复：`http://www.yqk.net`、`https://www.yqk.net`（= 修复目标，无其他）。
- 新增：`https://www.qimao.com`（失败原因 `Reader-Core request timed out` = 已知 qimao 超时挂账，网络波动非回归）。
- 不变：`https://www.yqxz.org` 前后均失败且原因一致（`[object Object]` = 已知错误序列化挂账，非解码路径）；`sjks88.com` 前后均不在失败集。

正向佐证：修复后两次搜索结果页均正常出结果（总裁/豪门 各 30 本，来源归属酷我小说），
全源扇出完成、39 条失败源无一是解码类错误。
yqk 未在结果归属中出现（0 结果或并入去重行）属规则/合并层面表现，
其 HTTP→解码→解析链路在编排器全量错误日志下零异常，即解码修复的直接证据。

## 5. 工件

- `baseline-hilog-0429-pre-fix.txt` — 修复前 hilog（yqk 失败原始行在内），SHA256 `0ce82d08…556ddbd`
- `post-fix-hilog-search-zongcai.txt` — 修复后全结算 hilog，SHA256 `e13c5881…46178d4`
- `failed-sources-baseline-40.txt` / `failed-sources-post-fix-39.txt` / `failed-sources-post-fix-haomen-39.txt` — 失败源 URL 集合
- `yqk-net-homepage.html` — 宿主机 curl 抓取（meta gb2312、gbk 严格可解码），SHA256 `be535464…b48f5de`

## 6. 边界

- 解码层修复闭环；yqk 搜索规则产出与结果合并策略不在本修复范围。
- `yqxz.org [object Object]`、`qimao 超时`、`[object Object]` 序列化均为既有挂账，与本修复无关。
