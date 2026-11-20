# 数据库存储迁移与强兼容审计（2026-10-30）

实施后状态：下文保留修复前的只读审计时点，不代表当前main仍只接受44。批准的[强兼容方案](../architecture/storage-strong-compatibility-plan-20261030.md)已经落地并签装原Mate90Pro；真实46正常读写/冷开、已知44–47与新旧维护矩阵、未知同步字段/原操作及覆盖前准入均有分层证据。最终HAP run `20261030T132057Z-fce869a1-1971f2d3`；当前VM仍46/DDL未变。供给更新中的缺席字段丢失另行修复并恢复55字段，业务供给更新/授权失效不冒充全库原行相等；详细失败、范围及未验收项见[执行记录](book-cover-handoff-20261024.md)。

## 范围与结论

用户要求查清数据库为何有这么多版本、版本递增逻辑以及何时真正不兼容；重申同产品版本必须强兼容。此次只读检查当前迁移源码、必要的 Git 历史和上一轮安装证据，没有运行数据库、测试、构建或设备命令，没有修改生产代码、用户库或 VM 状态。本文是审计记录，不是兼容修复或迁移验证通过声明。

源码基线：主 `Reader-Core` HEAD `80d614e929ae9e320ab767a1dc04579363c361d7`，dirty，实现至 SQLite 44；同步工作树 `.reader-isolated/harmony-native-phase1-20261020/Reader-Core` HEAD `958a9ff8358264506f1d49952abdc00f73a5f376`，dirty，实现至 47。两个 HEAD 的已提交文件均仅到 38；主工作树 39–44、同步工作树 39–47 尚未提交。实际能力必须绑定 dirty 文件/Native 字节，不能只看 HEAD。

结论：迁移号记录内部存储演进，47不表示47次产品发布，也不表示47次必然不兼容。当前编号同时涵盖追加表、列、索引、派生缓存修复、业务身份变更和持久状态协议变化；运行时却把高于自身的任何号码统一拒绝。部分迁移还确实破坏了旧程序的SQL或写入语义。因此必须分别治理“已做哪些迁移”和“哪些程序能安全读写”，不能只删除版本保护或合并到最新号码。

## 各种数字的含义

| 标识 | 当前证据 | 实际用途 |
| --- | --- | --- |
| HarmonyOS 产品版本 | 本次安装前后均 `0.2.0` | 用户可见版本；不是数据库游标 |
| HarmonyOS 安装计数器 | 本次安装前后均 `1000000` | 平台覆盖顺序；不是数据兼容证明 |
| SQLite `PRAGMA user_version` | 本机启动报实际46；main目标44；同步源码目标47 | Reader维护的内部结构/迁移游标，不是SQLite软件版本 |
| `SQLITE_MIN_READABLE_VERSION` | main为0 | main可向前迁移的旧库下限；不是对未来库的可读能力声明 |
| `STORAGE_DATA_FORMAT_GENERATION` | main为1 | 另一个非DDL数据形态边界；同步工作树没有这套常量/sidecar实现，不能认定两边均为1 |
| `STORAGE_SNAPSHOT_SCHEMA_VERSION` | 两边均18 | 备份/导出JSON格式，与实时SQLite游标独立 |
| `CONFIG_SNAPSHOT_SCHEMA_VERSION` | main为2 | 配置备份格式，与整库存储快照独立 |
| 同步本地状态/对外协议 | 同步工作树本地状态版本2，对外同步协议仍1 | v46变更本地状态封装；不能称为对外同步协议也升到2 |
| 内容格式、索引规范化标识 | 各自独立 | 章节正文语义、可重建别名索引等的局部身份 |

权威位置：main `crates/reader-storage/src/sqlite_backend.rs:172–190`、`src/lib.rs:98–103`；同步工作树 `crates/reader-domain/src/library_sync.rs:7–8`。项目 `VERSION_POLICY.md:22–26,182–187` 已明确DDL游标不是安装准入的充分条件，影响可读性/保数据必须另行治理，签名不能代替数据兼容性。

## 实际更新逻辑

1. 开发者手工提高 `SQLITE_SCHEMA_VERSION`，登记 `if current < N` 的DDL/数据处理；不是构建次数、时间、读书次数或SQLite自动分配。
2. 生产应用启动时打开持久库并读取 `PRAGMA user_version`。main先用只读探测检查上界/格式代际，再进入持久open；同步工作树直接进入自己的open/init/migrate路径。
3. 对低于目标且已有页面的库，用SQLite Backup API生成并验证一致性备份；包含WAL中已提交数据，不是只复制主文件。备份完成后才迁移。此机制目前在旧库启动路径同步执行。
4. 以进入迁移时读到的current为依据，执行所有缺失步骤；例如目标46打开44会依次执行45、46。没有“用户先启用同步”的条件。
5. 现代迁移通常在事务中同时提交DDL/数据变化及`user_version=N`；多步骤不是一个覆盖整条升级链的大事务，后一步失败可留下已完成的前一步。当前保留的1–16步骤不逐级发布游标；历史v16代码曾在整段末尾统一写目标号，因此不能说历史1–16从未发布版本。
6. 同号码不代表零变化：main在同schema提前返回之前，会检查搜索`normalization_version`并可能重建派生别名；同步工作树还在每次open检查并修订目录触发器策略。原始业务行和可重建派生数据应分开判断。
7. 当前main对高于44的任何库直接拒绝；这种保守拒绝能阻止未经审定的旧写入，却不等于已实现同产品版本强兼容。

主要入口：main `sqlite_backend.rs:800–826,860–938`、`migration_backup.rs:64–90,107–155`、Runtime `remote.rs:2096–2158`；同步工作树 `runtime.rs:517` → `remote.rs:603` → `sqlite_backend.rs:758–809,858–874`。派生索引重建在main `scoped_search.rs:156–174`。

## 当前保留的逐版本迁移清单

以下是当前源码的执行定义，不能冒充每个历史发布时完全相同的原始脚本。“追加”只表示不删除旧业务结构，未证明任意旧二进制能安全写入。

位置缩写：`sql`为main `crates/reader-storage/src/sqlite_backend.rs`；其他文件名默认位于main `crates/reader-storage/src/sqlite_backend/`；`S/`表示同步工作树相同目录。

| 游标 | 实际改动 | 数据/兼容性质 | 位置 |
| --- | --- | --- | --- |
| 1 | 书源、书籍、缓存、书架、正文、进度、进度历史、下载队列8表及索引 | 基础建库 | sql:220 |
| 2 | TXT目录规则、书签、替换规则、字典规则 | 独立表追加 | sql:328 |
| 3 | 分组、阅读时长记录 | 独立表追加 | sql:392 |
| 4 | TTS、搜索书籍/关键词、规则订阅、正文编辑、RSS记录/订阅、TTS配置共8表 | 独立表追加；注释只写4实体，少于实际表数 | sql:432 |
| 5 | 两张进度表增加可空location_revision | 查列后追加；旧整行替换若忽略新列，可能丢位置证据 | sql:2057 |
| 6 | RSS收藏、复合身份及排序索引 | 独立表追加 | sql:547 |
| 7 | 替换规则generation及撤销日志；旧规则补generation=1 | 新写入约束；没有自动推进generation的触发器，旧writer须适配 | sql:569,2389 |
| 8 | 正文编辑改为source/book/chapter身份；统一缓存正文语义 | 删除非local章节缓存/下载队列；DROP并重建全部content_edits，不搬迁旧编辑；新source_id必填 | sql:601 |
| 9 | source_books按source/book隔离；books限定本地/回滚用途 | 删除缺少本地书架/章节证据的books行；不猜测旧远程来源；旧读写职责改变 | sql:623 |
| 10 | 持久换源事务及phase索引 | 追加事务日志；旧写入是否绕过未决事务须审定 | sql:640 |
| 11 | 中文转换配置 | 独立配置追加 | sql:655 |
| 12 | 书籍高亮及索引 | 独立标记域追加 | sql:664 |
| 13 | 高亮规则、忽略大小写UUID唯一性 | 独立规则域追加 | sql:685 |
| 14 | 阅读记录增加author，默认空字符串 | 保留原主键/旧行；旧整行替换可能清空新信息 | sql:2075 |
| 15 | 替换规则增加scope_source，默认0 | 旧程序不理解新作用域；整行替换可能重置 | sql:2084 |
| 16 | runtime_fetch_clock | 追加跨重启逻辑时钟；旧写入不维护新时钟 | sql:990 |
| 17 | search_books主键由URL改为来源+URL；复制旧行后删旧表 | 旧按URL读取/删除缺少来源限定，可能读错或跨源删除 | sql:994 |
| 18 | TTS增加reader_profile、rate_percent可空列 | 追加列；需保护旧写入未携带的新字段 | sql:1029 |
| 19 | 正文增加content_format_version，旧行默认0 | 原正文不改；新程序据格式身份刷新旧缓存 | sql:1047 |
| 20 | 搜索关系状态、别名索引、回填及触发器 | 派生结构；写触发器依赖reader_search_aliases_v1，未注册的旧程序相关写入失败 | scoped_search.rs:180 |
| 21 | 内容搜索generation及回填、触发器 | 派生并发标识；SQL内建维护旧正文CRUD | content_search.rs:25 |
| 22 | 书源作者策略、替换6个触发器、重建别名 | 新触发器依赖aliases_v2/source_policy_v1，旧v21进程缺这些函数 | scoped_search.rs:248 |
| 23 | 章节字节明细/汇总、保留策略索引及触发器 | 派生计量；不删除正文 | chapter_metrics.rs:4 |
| 24 | 书源供给删除记录、bundle、item及触发器 | 追加供给账本；原书源表不改 | source_supply.rs:4 |
| 25 | 目录索引meta/rows及缓存失效触发器 | 可重建目录索引追加 | catalog_index.rs:88 |
| 26 | 正文document、分片、字节汇总、generation及失效触发器 | 派生结构追加；不批量改写原正文 | reading_documents.rs:590 |
| 27 | 书架投影epoch/revision及变更触发器 | 派生投影时钟追加 | shelf_projection.rs:24 |
| 28 | 目录索引增加可空level | 追加列；旧行NULL | catalog_index.rs:117 |
| 29 | 漫画manifest/head/progress | 独立漫画域追加 | manga.rs:9 |
| 30 | 漫画准入事实 | 独立事实追加 | manga.rs:16 |
| 31 | 漫画请求绑定及离线回执 | 临时请求与耐久回执语义分开 | manga.rs:19 |
| 32 | manifest拆出meta/page_index；迁移请求数组；删manga_resource_requests | 旧SQL若仍访问已删表会失败；原manifest保留 | manga_entry.rs:8 |
| 33 | 位置归属索引、目录facts失效、目录/书源guard | 派生策略；同步工作树后来又在同号码下修订这组触发器 | sql:1103; directory_revision.rs:10 |
| 34 | 漫画准入变化推进书架revision | 派生失效策略修正 | shelf_projection.rs:71 |
| 35 | 漫画永久保留、访问时钟、会话保护 | 永久事实与临时会话域分开 | manga_retention.rs:15 |
| 36 | legacy protection回填、session runtime/runtime_epoch | 清除不能证明仍有效的旧临时会话行；旧writer缺新runtime身份 | manga_retention.rs:27 |
| 37 | 下载claims、物化leases、evicted/clear状态；重建access/receipt表，把version加入主键 | 旧行复制保留；每章节唯一改为每章节每版本唯一，旧查询/覆盖假设改变 | manga_storage_policy.rs:67 |
| 38 | 修正入书架时正文失效触发器 | 缓存策略修复，保留试读确认材料；不改用户记录结构 | reading_documents.rs:510,581 |
| 39 | 本地书scalar facts失效及书架revision触发器 | 派生事实维护；不改原阅读坐标 | local_book_metrics.rs:151 |
| 40 | 修正首个本地位置proof写入时正文失效条件 | 等价proof不再删派生正文；没有新增表/列 | reading_documents.rs:527,572 |
| 41 | library identity/authority、书籍身份、别名、journal、章节绑定及初始化 | 结构追加；旧写必须满足新身份/恢复语义，不能只看表可用 | library_identity.rs:6,37 |
| 42 | 元数据恢复回执、fence、资源adoption及撤销触发器 | 追加恢复事实；旧读若忽略资源准入可能消费未确认资源 | library_resource_restore.rs:593 |
| 43 | 扩展resource_adoptions的kind约束，支持封面/原件；复制旧行、恢复触发器 | 保留旧列旧行；新资源kind需要兼容消费 | library_resource_restore/book_resources.rs:4 |
| 44 | 恢复本地位置的归档、facts、confirmations | 原始恢复坐标与当前有效进度分离 | restored_local_positions.rs:7 |
| 45 | sync state/marks、writer ID、标记稳定ID回填、epoch/tombstone触发器 | 追加同步身份/基线；普通SQL有部分自动维护，完整恢复/同步仍需新语义 | S/library_sync_storage.rs:21,64 |
| 46 | 本地sync state封装升为2；新增log receipts及channel索引 | 持久JSON状态语义变化，保留原active/身份/基线；对外同步协议仍1 | S/library_sync_storage.rs:91 |
| 47 | 新建窄sync clock、复制epoch，触发器只更新新表；保留但停止维护旧epoch | 旧同步读旧epoch会陈旧；代码明确依赖旧程序拒绝user_version47，属于实际旧写/并发语义断点 | S/library_sync_storage.rs:102,118 |

历史数量说明：v17/v18曾在同一提交`79429054`进入；v23–v27同属`153d11f5`（2026-09-23）；v29–v33同属`e26f46c5`；v35–v37同属`cda477f4`。一个提交可能登记数步，迁移号并不对应发布次数。未发现main与同步工作树将同一号码分配给两个完全不同功能；但已确认v33调用的触发器定义发生同号修订，39–47的dirty修改也没有完整提交历史可证明从未改写。

## 真正不兼容的条件与本次发现

| 条件 | 当前代码实例 | 需要区分的结果 |
| --- | --- | --- |
| 删除/改名旧程序仍依赖的表列、增加旧写无法满足的必填约束 | v8正文编辑新增必填source_id；v32删旧请求表 | 旧SQL可能直接失败 |
| 主键/业务身份改变，旧查询限定不足 | v17来源+URL；v37章节+版本 | SQL可能成功但读错、覆盖错、删多条，更不能仅测能否打开 |
| 持久触发器依赖旧进程缺失函数 | v20/v22搜索触发器 | 基础读取可能可用，相关写入会失败 |
| 同字段形状下改变内容含义、JSON状态或原操作协议 | v8处理前正文；v19格式标识；v46本地同步状态2 | 需要正确解释及保留未知状态；不能用DDL游标代替语义判定 |
| 新不变量由新业务代码维护，旧写绕过它们 | v7撤销generation；v41–46身份、资源恢复、同步pending/baseline | 旧写未必报错，但可能使新事实失效 |
| 新表接管权威值，旧字段不再保持一致 | v47旧epoch不再更新 | 旧并发比较将读取陈旧值；不能靠“字段还在”宣布兼容 |
| 导入/恢复只认识旧形状并整体替换 | main元数据/快照恢复缺少同步pending、mark暂停和baseline处理 | 即使普通CRUD兼容，完整恢复仍可能破坏新域身份 |
| 仅有版本上界拒绝，没有执行到数据访问 | 本机46、main44 | 是保守拒绝，不是已经证明结构不可读或用户数据已损坏 |

v17的旧schema16源码（`79429054^`）按URL读取/删除search_books，无origin限定；v20父提交`585cd0e0^`没有搜索UDF；v22父提交`3af5c878^`只有aliases_v1，没有新触发器要求的两个函数。这些风险有具体旧代码依据，仍没有在本轮执行历史二进制测试。

**需要单独处理的用户数据保留问题：** v8的`DROP TABLE content_edits`没有复制或归档旧正文编辑，确实会从升级后的活动库移除旧编辑。v9还删除无法归属本地的旧books记录。前者不能因临近注释只讨论“可恢复远程缓存”就当作普通缓存清理；整库备份也不等于业务数据在新程序中仍可用。这些步骤只对低于对应游标的旧库执行，当前46库不会再次执行v8/v9；本轮没有对用户库执行它们。

## 与同产品版本强兼容要求的差距

- 保留迁移序号是必要的，用于准确补齐旧库缺失步骤；压低号码、删历史或改数据库游标都不能解决兼容。
- 不能把每个DDL修订都变成整库不兼容。新增独立表、可空/默认字段、索引、可重建缓存，应设计旧读写保留新数据的路径，并核查旧整行替换、恢复和清理。
- 必须有独立、统一的读写兼容契约，覆盖表/列形状、SQL函数、业务身份、状态协议、原操作恢复和未知字段/域保留；单一数字或只读成功不足以证明强兼容。
- v47明确靠旧包拒开兜底，而产品版本仍未形成经用户授权的跨版本边界，这与本次用户要求直接冲突。需改迁移及读写适配，不能用新VM或抬产品版本消除表面症状。
- 同步工作树尚缺main的格式代际/sidecar机制；两个工作树应统一权威能力来源，不能各自演进后共用产品标签却没有兼容准入。
- 安装前必须验证候选能力与设备事实；上一轮已定位pipeline只验签名身份而没有存储准入。运行时阻止错误写库发生得晚于覆盖安装，不能替代交付前校验。
- 已交付迁移应保留可追溯定义；可重建缓存策略若另行演进，也必须有自己的身份和兼容范围，不能让相同schema被误读为相同存储行为。

后续修复须先选定同产品兼容范围，以真实旧库和原程序实现验证升级、新旧构建读写往返、未知域保留、导入恢复/未决同步、失败恢复和安装准入。本文未开展这些验证，不能将静态分类记作兼容通过。
