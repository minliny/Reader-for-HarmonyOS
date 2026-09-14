# PH75：旧远程正文升级的位置保护缺口

2026-09-14，来源为 PH71 正文兼容修复的代码审计。这里记录的是升级风险与尚未实现的闭环，不是用户已丢失进度的结论。根任务已决定：**本轮不在 Harmony Gateway 自动刷新旧正文缓存**。本专项没有修改生产、测试、设备或 Core 数据。

## 已核实的链路

| 当前实现 | 确切能力与缺口 |
|---|---|
| Core `remote.rs:9219 cached_chapter_content_result` | 普通读取优先返回旧 canonical cache。新增格式版本/旧格式标记可识别历史正文，但标记不能等同于安全替换许可。 |
| Core `remote.rs:9399 materialize_canonical_chapter_cache` | force 成功通过 `put_chapter_cache_if_newer` 或 `complete_chapter_download` 发布正文；按发起代次防迟到旧请求覆盖。没有章内字符位置迁移。 |
| Storage `sqlite_backend.rs:1084 put_chapter_cache_if_newer` | 条件 SQL 只更新 chapter_cache；不更新 reading_progress、书签、高亮。原子替换缓存不等于正文与位置原子迁移。 |
| Core `reader_content::remap_reading_progress`（lib.rs:6800） | 用新旧 TOC 的映射改章节索引；保留章内 offset。适用于目录顺序变化，不适用于同章正文长度变化。 |
| Core `remote.rs:9979 reader_location_resolve` | 原样使用传入 chapterOffset 构造 canonicalLocation/revision；不读取旧/新正文，不进行文本锚点查找。 |
| Harmony `RemoteReadingFlowGateway.resolveLocation:637` | 还明确校验 Core 返回的 chapterOffset 必须等于请求 offset。因此不能把现有方法说成可接收正文重映射结果。 |
| LRE `loadInitialChapter:2924` → `openChapter:3126` | 先读并保留 progress，再取章节。若章节获取中静默刷新，保留的 progress 已基于旧正文。 |
| LRE `configureRestoredAnchor:3311` | 使用原 offset；越界时才按比例回退并夹到可见末尾。contentVersion 只参与内容/分页身份，不能修复旧锚偏移。 |

书签的显式 requestedOffset 同样在 `configureRestoredAnchor` 夹取数值，不重新匹配原书签文字。只保护当前 progress 仍不足以保护历史书签、高亮起止点及尚未结束的定位请求。

## 生产方法最小证据

通过现有 SDK ordinary-method probe 执行 `configureRestoredAnchor`、`lastVisibleScalar` 与真实 ReadingSurfaceLayoutMap。诊断文本不是第二书源真实载荷，也没有作为正文解析算法使用：

- 旧正文：`开头\\r\\n目标文字…`，`目` 的标量位置为 6。
- 新正文：`开头\n目标文字…`，同一 `目` 的位置为 3。
- 当前方法仍恢复到 6，实际落在 `字`，长度充分且没有触发末尾回退。

探针：[源码](ph75-position-protection/anchor-probe.mjs)、[结果](ph75-position-protection/anchor-probe-result.json)。首次本地载入碰到 Node strip-only 不支持 TypeScript 参数属性；改用仓库既有 probe 的等价构造参数赋值展开后通过，未改变生产算法。首次 loader 错误、工具选项失败及最终执行日志亦保存在 `ph75-position-protection/`。

## 现有本地能力可复用到哪里

`Reader-Core-Native/crates/reader-runtime/src/remote/local_book_positions.rs` 已存在正文锚点规划：

- 166–201：取旧位置前后各最多 48 个非空白字符；短上下文拒绝，不按百分比猜位置。
- 204–241：使用已引入的 `regex::RegexSet` 作多模式匹配，唯一结果才接纳，使用 Unicode scalar 输出坐标；逐章处理而非拼成第二份全书。
- 242–267：两侧上下文冲突、重复片段、缺失匹配直接拒绝迁移。
- 后续同时调整进度、书签、高亮；Storage 的 `local_book_positions.rs` 使用旧章完整行哈希和完整位置状态作 CAS，保持笔记、书签时间、阅读时间与成员状态。

**可以复用纯文本锚点匹配步骤和事务校验原则；不能直接复用完整 local plan。** 其入口要求原始文件 SHA 相同、`sourceId='local'`、LocalBook 导入物化结果；SQLite 的 query/put 也写死 local/legacy 身份。远程相同 URL 不保证内容相同，不能删除原文件身份校验后直接调用。算法层应提取现有实现供两条薄适配共享，继续使用现有 regex 能力，不再新增通用匹配引擎。

## 最小完整实施方案（尚未实施）

1. **冻结证据与身份。** 远程迁移限当前同 sourceId/bookId/chapterIndex/chapter URL，记录源规则版本、旧 canonical body/visible projection 哈希、新正文及格式版本。旧正文/位置不足、身份冲突或源已更换时，不更新旧 cache。
2. **复用现有唯一锚点匹配。** 抽出本地模块中纯锚点规划，输入旧/新可见正文与待保护位置。局部 chapter 适配无需全书扫描；仅文本一致时可沿用数值，匹配缺失/重复/冲突时返回“保持旧内容，迁移未决”。对存在图片占位或处理配置变化的情况也必须保持相同投影单位。
3. **一次覆盖所有关联坐标。** 收集当前进度、仍可能恢复/同步的进度历史、该章书签、高亮两端，以及本次 Host 的显式定位点；书签仅按书名作者归属时须先证明归属无冲突，不能迁移同名不同源数据。保留成员状态、历史时间、笔记/摘录、设备归属；坐标变化不新增一次阅读记录。
4. **发布为同一存储事务。** 在新正文发布前再次比较旧正文哈希、格式版本、规则版本及完整位置快照。内容、位置、位置版本与下载状态必须一起提交；期间用户翻页、加书签、备份恢复、换源或另一请求先发布，都使旧计划失效。只在 Host 先查一次 progress 再 forceRefresh 无法解决竞态。
5. **向 Host 交付迁移结果。** 现有 reader.location.resolve 是原位确认合同，不强行改成另一含义。章节结果需携带已提交的旧/新内容身份和位置迁移结果；LRE 在现有 selection/lifecycle 准入内更新先前加载的 restoredProgress 或显式定位目标，再测量/提交。旧内容页面或旧请求持有的 offset 不能写回新正文；退出保存、TTS/自动翻页、书签定位都沿同一内容身份保护。没有完成此步骤，单改 Gateway 仍不安全。
6. **失败仍可读。** 离线模式不触发网络或迁移；在线取新内容失败、迁移不唯一、CAS 冲突或取消，保留旧内容及全部原位置。成功前不删除旧 cache，不在缓存命中时盲跑 JS，不以清缓存使问题消失。
7. **必须完成的回归。** 唯一锚点、重复/短片段、旧正文缺失、章末/emoji/CRLF/图片、进度+书签+高亮同时迁移、并发进度/书签/恢复冲突、fetch 晚到、事务失败/崩溃恢复、离线零网络、升级失败旧文可读、Host 先读旧 progress 后收到新正文、显式书签请求与退出保存旧版本拒绝。迁移前后所有非坐标用户数据逐项相等。

这不是增加一个判断即可闭环的 Gateway 修改；核心边界是 Core 正文与位置事务，以及 Host 已捕获定位意图的版本衔接。当前已授权的新正文修复可以作用于新获取正文，但没有把历史缓存自动迁移称为已完成。该缺口不妨碍本轮保留历史内容与数据，后续仍需按上述范围实施和验证。
