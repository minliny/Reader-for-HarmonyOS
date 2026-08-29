# 挂账 B2 群：错误序列化统一 + 简介 `<br>` 清洗 + 书架进度 `<1%` — 证据包

日期：2026-08-30 ｜ 分支提交：worktree 分支 `fix/ledger-b2`（基点 5079edc = main HEAD）

## 1. 问题与根因（三项，均为既有挂账）

### 1.1 `[object Object]` 错误序列化（主项）

基线 HAP（gb2312 修复版 a00b9d1c）全源扇出日志中，yqxz.org 等源的失败原因显示为
`Search source https://www.yqxz.org failed: [object Object]` —— 失败原因不可读，
阻断后续所有证据会话的归因（contracts 漂移收敛、ACQ-02、SHF 均依赖可读错误行）。

根因链：非 `Error` 实例的被抛对象（NAPI RPC 信封、运行时 throw 的普通对象）在
`HttpExecuteHost.ts` 被模板字符串展平：``error instanceof Error ? error : new Error(`${error}`)``
→ 对象失去结构只剩 `[object Object]` → 下游所有 `.message` 读取方（SearchGateway、
SearchOrchestrator hilog 等 ~28 处 catch 点）全部显示 `[object Object]`。

### 1.2 详情页简介 `<br>` 残留

源站简介文案内嵌 HTML 换行标签（`<br>` / `<br/>` / `<BR>`），原样渲染为字面文本，
且常出现在首行导致简介以 `<br>` 开头。

### 1.3 书架进度 `已读 0%`

Core `read_progress` 是 0..10000 基点（Reader-Core-Native
`crates/reader-runtime/src/remote.rs:10774`：
`((chapter_index + chapter_progress)/chapter_count).clamp(0,1) * 10_000.0`）。
显示端 `/100` 换算正确；"0%" 是长书开头 `floor()` 把 <1% 的分数塌缩为 0，
与"未读"不可区分——展示缺陷而非数据缺陷。

## 2. 修复内容

### 2.1 统一错误序列化（1 新文件 + 25 处 catch 点收敛）

- 新增 `entry/src/main/ets/app/ErrorMessage.ts`：`errorMessageOf(error)` 统一口径 —
  `Error`→`.message`；字符串→原样；对象→优先 `.message` 字符串字段，否则
  `JSON.stringify` 截断 500 字符（`{}`/`[]`/循环引用退回 `String(error)`）。
- `HttpExecuteHost.ts` 失败入口改为 `new Error(errorMessageOf(error))`，
  非Error 被抛对象在源头恢复可读结构，全链路（ReaderCoreGateway→SearchGateway→
  SearchOrchestrator hilog）无需感知。
- 其余 catch 点（TTS 双 Host、ReaderHostRegistry、CookieSessionStore、ReadingSession/
  ReaderTts/RemoteReadingContract、Source/SourceSwitch/SourceOrchestrator、
  LocalBookImport、Sync/WebDav、Index.ets、LocalReadingExperience、
  ReaderReplaceQuick、SearchOrchestrator）统一走同一 helper。
- 反回归：`tools/test-error-message-conformance.mjs` — 行为向量 9 组
  （Error/string/.message 字段/JSON 截断/null/数字/循环/空对象）+ 全仓 88 个
  .ts/.ets 源扫描（三种旧展平写法零残留）+ 关键修复点形状断言。

### 2.2 简介 `<br>` 清洗

`entry/src/main/ets/features/bookshelf/LocalBookDetail.ets`（在线详情经 Index.ets
复用同一组件）：`displayIntro()` 将 `<br>` 族标签归一为真实换行并去首尾空行。

### 2.3 书架进度 `<1%` 可见化

`entry/src/main/ets/features/bookshelf/BookshelfPage.ets`：网格/列表进度统一走
`shelfProgressText(基点)` — `0 < 基点 < 100` 显示 `已读 <1%`；列表视图保留
`更新 N 章`/`未读` 优先级不变。

## 3. 合同与构建

- 合同测试 89/89 PASS（Node 24；4 个 data-URL 加载器内联 ErrorMessage helper，
  4 个 Node 直载文件按仓库先例用显式 `.ts` 后缀 import）。
- HAP：`entry-default-signed.hap`，SHA256
  `0de0f6b6bfb59b0989023faf67e6a42a260a14d3ad07224099fed48976ac29d8`（131,063,123 B）。
- 构建：DevEco 内置 hvigor + `DEVECO_SDK_HOME=/Applications/DevEco-Studio.app/Contents/sdk`，
  BUILD SUCCESSFUL；worktree 需先 `ohpm install` 建立 `entry/oh_modules/@reader/core-harmony`
  （symlink→`entry/vendor/core-harmony`），签名配置为本机 build-profile.json5 机本状态（不入库）。
- preflight：`signature=SIGNED / signatureVerify=PASS / nativeLayout=PASS /
  sourceNewerThanArtifact=NO`。

## 4. VM 实证（127.0.0.1:5555，install -r 保留数据）

装机前后 bundle 元数据一致（`versionName 1.0.0 / versionCode 1000000 /
appProvisionType debug`），install 返回 `install bundle successfully`，未出现
9568332 签名冲突；VM 上书籍数据（书架/进度/源库）全程保留。

方法：启动应用 → 书架 → 搜索"总裁"触发 65 源全扇出 → `hilog -x` 全量导出
（7,223 行），提取全部源级失败行（每源失败必落一行 `Search source <url> failed: <原因>`）。

### 4.1 `[object Object]` 归零（主验证点）

- 全部 **38 条**源级失败行中，含 `[object Object]` 的行数：**0**（修复前基线中
  yqxz 等源该形态成批出现）。
- 上一基线挂账源 yqxz 现在可归因：
  `Search source https://www.yqxz.org failed: Internal error`。
- 38 条失败原因分布（全部为可读文本）：`The server returned nothing (no header
  or data)` ×23、`Internal error` ×8、`Cannot read property length of undefined`
  ×4（JS 引擎结构化错误，修复前正是会塌缩成 `[object Object]` 的形态）、
  `cannot auto-build searchRequest: source.searchUrl is empty` ×1、
  `Reader-Core request timed out: 100` ×1、`Invalid SSL peer certificate` ×1。
- 同扇出正向产出：结果页"找到 30 本书籍"正常渲染（截图在案）。
- yqk.net（http+https，gb2312 修复对象）与 sjks88 本轮均不在失败集；qimao 本轮
  未超时——三者均为网络态相关表现，无回归。

### 4.2 详情页简介 `<br>` 清洗

书架点击剑来 → 续读进入正文（顺带实证 shelf-tap-resume 合同）→ 返回落详情页
（detail-return-origin 合同）：简介块渲染为三行真实换行
（"大千世界，无奇不有。/ 我陈平安，唯有一剑… / 敕神，摘星…开天！"），
**零 `<br>` 字面残留**（截图在案）。

### 4.3 书架进度 `已读 <1%`

剑来（超长书，开局进度 <1%）书架网格卡显示 **`已读 <1%`**，不再塌缩为
`已读 0%`（全页 + 放大截图在案）。

## 5. 工件（均在 `artifacts/`）

| 文件 | 内容 | SHA256 前 8 |
|---|---|---|
| `post-fix-hilog-search-zongcai.txt` | 修复后全扇出 hilog（7,223 行，38 条失败行零 `[object Object]`） | `a81183fb` |
| `failed-sources-post-fix-38.txt` | 失败源行集合（38 条，含可读原因） | `cca86fd4` |
| `search-results-zongcai-30books.jpeg` | "总裁"结果页（30 本，全扇出完成） | `67ee898c` |
| `bookshelf-grid-sub1percent.jpeg` / `-zoom.jpeg` | 书架网格 `已读 <1%` 全页/放大 | `59332a07` / `ef692d77` |
| `detail-intro-no-br-full.jpeg` / `-zoom.jpeg` | 详情页简介无 `<br>` 全页/放大 | `9d54f085` / `a775704c` |
| `shelf-tap-resume-reader.jpeg` | 书架点击直接续读正文 | `8e0deb54` |

## 6. 边界

- yqxz 失败的**具体业务原因**（超时/规则/网络）在错误可读化后才能归因，属后续
  源健壮性会话；本修复只保证日志行可读。
- `qimao 超时` 为独立挂账，与本修复无关。
- 书架"已读 0%"修复仅改显示口径；进度恢复/上报链路不变。
