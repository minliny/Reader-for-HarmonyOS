# PH85 旧缓存格式 1 → 2：只读接线审计

本轮只读审计 Runtime、PH75、Harmony 读取/刷新调用链，并在 `/private/tmp` 引用原生产文字锚点模块运行受控探针。未修改 Runtime、Host、存储或测试，未运行设备操作。并行 PH90 的文件归其 owner；以下位置是审计时快照，可按函数名定位。

## 结论

**最小且当前有完整调用方保护的接线是：统一远程正文格式版本 2，普通缓存读继续只读，由现有“更多→刷新”发起当前章的显式 PH75 更新。** 当前 Host 从未设置 `upgradeCachedContent`，也没有消费/保留 `contentRefreshRequired`；只升版本不会自动改写旧缓存。不能把普通 `chapter.content` 缓存读取偷偷改为网络刷新：同一读取入口同时供当前章、邻章预取、搜索结果预解析及位置证明读取使用。

PH75 已能在有足够证据时原子更新当前章正文、进度/历史、书签/批注与 Host 锚点，并在证据不足时保留旧内容；**它并不保证每个带 JSON 包装的旧正文都能更新成功**。原始响应和提取前位置关系没有保存，不能从缓存中的 `[...]` 外形猜它一定是序列化错误。

如果后续要求“打开旧章自动更新”，可复用 PH75，但必须在 Host 新增明确的“当前章更新意图”与完整位置上下文、结果/失败处理，不能仅让 Gateway 对所有在线 `loadChapter` 默认传 true。下面给出具体条件；它不是当前已经接上的行为。

## 实际读取与更新链

1. `remote.rs::chapter_content_from_input`（约 9220）：仅当 `upgrade_cached_content=true` 且指定章的旧缓存格式 `<1`，才转为 `force_refresh=true`。随后显式 `jsRule/chapterResponse/chapterRequest` 和网络路径都在网络前冻结源版本并 `capture` 位置基线。
2. `cached_chapter_content_result`（约 9298）：无 force 时读取指定 `(source,book,index)`；验证当前 processing 与可选 positionContext，使用缓存内容和缓存旧 title 做可见投影。不会运行源提取规则；返回原 format/bodyVersion、refreshRequired。
3. `finish_chapter_content_result`（约 9470）：新页合并及完整源替换完成后检查预算/源版本，交给 PH75 `publish`；不能绕过 publish 直接覆盖缓存。
4. `remote_content_positions.rs::capture`（258）：抓取旧章/书籍/源/目录、进度历史、书签高亮及其持久证明、配置与队列状态；验证 Host 传入的旧 body/processing 身份和每个锚点。
5. `plan`（335）：仅映射目标章坐标；复用 `text_position_anchors` 和已有 regex 多模式匹配，不重标未证明的旧书签，不用“差几个字符”推算。短文、歧义、旧范围越界、身份冲突、未证明 marks 等返回保留原因。
6. `publish_with_checkpoint`（517）→ Storage `commit_remote_chapter_positions`（`sqlite_backend/remote_content_positions.rs:568`）：整组旧状态 CAS，正文和相关位置/证明在同一事务提交；并发修改不能回滚到旧快照。取消/超时/源版本变化拒绝发布；位置计划失败返回旧正文和 `status=preserved`。网络/解析在发布前失败时旧缓存仍在，但命令返回错误，需要调用方执行原有恢复路径。
7. 现有 Host 显式入口：`LocalReadingExperience.ets::refreshCurrentChapter`（9355）→ `selectChapterAnchor`（9390）从已显示章捕获当前页 `requested` offset 与 body/processing → `loadSessionChapter(forceRefresh=true)` 绕过窗口缓存 → `RemoteReadingFlowGateway.loadChapter`（450）转发 force+context → `decodeRemotePositionMigration` → `openChapter`（3154）验证回执并使用映射位置。当前控制栏选择的失败恢复能保留/核对原阅读画面与位置。

## 必须统一的版本点：不止两个数字

建议在 Runtime remote 模块定义一个 `CURRENT_REMOTE_CONTENT_FORMAT_VERSION: u32 = 2`（或放现有跨模块格式归属处），以下所有**新内容**身份/写入/判定共用它，不改 SQLite schemaVersion 或 JSON snapshot schemaVersion。

| 文件/函数 | 审计时位置 | 最小变更 |
| --- | --- | --- |
| remote.rs，升级请求判定 | 9236 | `< CURRENT...` |
| remote.rs，cached response | 9353 | refreshRequired 使用同一阈值，format/bodyVersion仍来自旧 entry |
| remote.rs，finish 非 PH75 回退响应 | 9533 | 新 bodyVersion 用 CURRENT，不能写2却哈希1 |
| remote.rs，materialize 回退写入 | 9566 | 新 entry.format=CURRENT |
| remote_content_positions.rs，无旧 body 分支 | 551 | **只有无 detached proof 时**默认 CURRENT；有 proof 必须继续用 proof.content_format_version |
| 同分支响应 | 597 | refreshRequired 使用 CURRENT |
| PH75 有旧 body 的新 hash | 647 | 新 bodyVersion 用 CURRENT；旧 hash仍用旧 entry.format |
| PH75 原子替换 entry | 691 | 新 entry.format=CURRENT |
| PH75 installed 结果格式 | 746 | 成功发布格式 CURRENT；preserved仍用旧 entry.format |
| PH75 最终响应 | 784 | refreshRequired 使用 CURRENT |

普通带有效 chapterIndex 的首次取章通常也进入 PH75 无旧 body 分支，所以只改 `materialize_canonical_chapter_cache` 会漏掉主要写入路径。

`acquisition::body_version` 当前哈希包含 `(reader-body-v1, format, content)`。相同内容从 format1 升2也会改变 bodyVersion；回执应是 committed（processingVersion可以不变），不能假报 unchanged。旧内容 read/mark/detached proof 的 hash 算法和旧 format 均不能被 CURRENT 常量覆盖。本地导入仍使用自己的 format0 路径，不纳入远程格式升级。

## 当前最小交付动作

1. Runtime owner 完成上表集中版本薄接，保留 ordinary cached read 不联网。无需新数据库迁移或全库遍历。
2. 用户选择当前章“刷新”时，沿上述已存在的 forceRefresh+positionContext 路径取新正文，保留源/章节 URL 身份校验和 PH75 事务。
3. Host 必须区分回执：committed 才说更新完成并使用映射锚点；unchanged 表示身份和可见空间均未变；preserved 保留旧正文和坐标，并在现有刷新反馈位置说明“为保留阅读位置，本次正文未更新”，记录有限 reason，不能显示已成功。当前 `openChapter` 只主动处理 committed，其余会继续呈现返回正文，需要补反馈。
4. 网络/取消/解析失败复用原控制栏选择恢复，不再清缓存重试。并发位置过期不能盲目拿旧 context 再覆盖，按已有版本错误恢复。

## 自动升级需要的额外明确接线

允许自动化的对象只能是这次真实前台打开/刷新意图所指章节；邻章预取、离线、停用/删除源、源版本/目录上下文待更新、位置证明只读调用、prepared cache 复用均不触发。

- `ReadingSessionChapter` 和 Gateway 需保留合法的 `contentFormatVersion/contentRefreshRequired`，同时把“当前章允许更新”意图区分于预取。不能在目前无 intent 的公共 loadChapter 统一设置升级参数。
- 先得到旧缓存及其准确 body/processing 身份，然后由 LRE 捕获**本次将使用的所有旧坐标**：初始 restored、明确 requested、已显示当前页等。仅 Gateway 得到字节后合成一个空 anchors，不足以覆盖 LRE 尚未传下来的坐标。
- 版本与坐标均有证据后，最多发起一次相同 source/book/chapter/URL 的 `upgradeCachedContent:true` 请求并携带 context，复用现有 decoded receipt 和 selection/lifecycle token。旧format已变或snapshot失效时停止，不递归刷新全书/整源。
- 首次加载尚无稳定画面时，网络错误不能直接把可读旧章变成失败页；应先呈现旧章，或保留该旧章作为明确的 fallback。preserved/失败当次不自动重试；离线为零网络。后续用户主动刷新可新建一次意图。
- 章窗口和 preparedChapter 需按新 body/contentVersion 的现有准入规则更新，不能保留同章旧内存对象。现有窗口命中会绕过 Gateway，不能宣称只在 Gateway 增加 flag 就实现所有场景。

这条额外接线可以工程上完成，但不是“普通缓存读直接变联网”一行代码；在它没有正式回归前，本轮应使用已有显式刷新入口。

## 锚点限制的真实生产模块探针

`cache-anchor-probe.rs` 用 `#[path]` 直接引用当前 `remote/text_position_anchors.rs`（无复制/改写算法），将旧 `['段落数组的JSON表示']` 对照新段落文本；探针本身不连接数据库，验证的是 PH75 使用的原锚点算法，不冒充完整事务测试。

`cache-anchor-probe.log` 结果：旧 offset0、30、章尾123 → `text_anchor_missing_or_ambiguous`；旧 offset50 → 正确映射48。旧包装符进入前后48字符锚点时，新正文里没有该序列，保留是必要的安全结果。**不得靠删除括号、按比例估计位置、把所有旧0/章尾无条件改新边界来强行通过。** 当前边界无法证明时仍保留，不能借本轮版本升级顺带换另一套映射算法。

## 接线必须补/复用的真实测试

在 `reader-runtime/tests/search_content_commands.rs` 既有正式 dispatch harness，以及 `remote/remote_content_positions.rs` 的生产 finish/publish/SQLite 事务测试中扩展，避免只测新辅助函数：

1. 旧 format1 松鹤样式缓存 + 会抛错的源规则，普通 chapter.content 仍同步返回缓存、无 Host 请求、refreshRequired=true、整组快照完全不变；扩展现有 `legacy_chapter_cache_remains_readable_without_reexecuting_source_rules`（约629）。
2. 同缓存且显式 upgradeCachedContent，经真实 chapter.content → Host request → continuation 返回合成松鹤原响应；成功时 format2/hash/回执/缓存一致，且只修改目标章。不能用直接 chapterResponse 绕过升级 flag 的分支验证。
3. format2 缓存 + upgradeCachedContent=true 不发生额外 Host 请求；用户 forceRefresh=true 仍允许主动刷新。
4. 无旧 body 的正常首次获取、PH75 有旧 body 的更新、非持久预览回退响应，新格式和 bodyVersion 一致；下载队列成功和正文仍原子。
5. 旧format1与新format2可见内容相同，回执 committed，offset和用户时间/设备/备注不变；避免格式号与返回hash不同步。
6. 原坏数组正文，至少覆盖探针的可映射中段、章首/章尾/包装附近无法映射；后者必须 preserved、旧format1及整组位置不变、refreshRequired仍true。复用现有进度/历史/书签/批注/Host anchors的完整保护断言。
7. 原 PH75 的并发进度 CAS、源/目录变化、处理配置变化、取消/超时、写入故障回滚、未证明旧marks、重复/短文本用例保持；网络/空/规则异常返回失败时缓存不变。
8. detached proof 的旧format0/1无缓存正文：仅字节和旧处理空间完全相同可按proof的旧格式恢复；不同正文拒绝。不能强制把恢复行戳成2后导致旧proof失配。复用 `remote_cache_clear_retains_position_facts_and_restores_only_identical_body`（1711）及其配置/坐标漂移用例。
9. Host `tools/test-remote-position-migration.mjs` 扩展刷新前context复制、preserved反馈、失败保留、旧scope拒绝、窗口/ prepared 不绕过 force；若采用自动意图，再加前台一次/预取零次/离线零次/过期取消/失败旧章fallback等交互合同。

这里只列出所需接线和验证，未执行 Runtime 修改或这些尚待添加的测试。PH85 提取语义的 824 项 PASS 属于另一切片，不能拿来证明此缓存版本薄接已经完成。
