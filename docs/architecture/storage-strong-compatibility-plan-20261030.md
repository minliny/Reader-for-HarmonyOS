# Reader 存储强兼容实施方案（2026-10-30）

状态：用户于2026-10-30批准的实现、定向回归、指定签名HAP及原VM最小闭环已完成。最终run为`20261030T132057Z-fce869a1-1971f2d3`，保数据安装与实际Native三身份核验通过；原v46没有升级47。精确300ms设备输入、逐帧视觉连续性/帧率、物理真机、真实远端同步与用户验收仍OPEN，不能用本地方法或VM结果代替。依据：[数据库迁移审计](../issues/storage-schema-evolution-audit-20261030.md)与[完整执行/失败记录](../issues/book-cover-handoff-20261024.md)。

完成证据与实施偏差：19个不同storage case、8个Runtime存储case、5个source-supply case及已登记Host精确入口通过；未运行全量。P6真实历史包缺陷保留为负例，五项维护矩阵及两代typed补验有各自真实证据。下方P6表保留最初拟落点；实际测试落在生产模块的libtest中，准确selector/编译范围/复用与失败attempt以执行记录为准，没有建立表中拟议的integration test文件。

原VM后证：17条书架/7条进度身份、完整原sync payload/operation、Host journal/config head/ciphertext保持；已操作位置50%→56%并冷重开。随包供给按原策略退休828条（86条启用转停用）、升级18条、新增70条，原919身份无删除；该业务更新不冒称原行全等。发现的缺席外部字段丢失已修复，并以正常系统文件导入恢复16条/55字段；最终989条书源严格等于供给后状态加这些补字段。7条因source定义变化失效的grant不复活，剩余47条保持。原VM持续运行，应用返回普通书架；没有新建、清库、卸载、替换实例或整库还原。

当前生产位置（2026-10-30收尾核行）：

| 实际owner | 当前文件/行 |
| --- | --- |
| 统一布局上下文、只读准入、连接事实 | Core `crates/reader-storage/src/sqlite_backend/storage_layout.rs:18,71,272` |
| Runtime之前的独立probe | Core `crates/reader-runtime/src/storage_maintenance.rs:22` |
| 同步状态持久写入的未知事实保护 | Core `crates/reader-storage/src/sqlite_backend/library_sync_storage.rs:116` |
| 随包供给的字段归属/缺席保留 | Core `crates/reader-runtime/src/remote/source_supply.rs:106,190` |
| Host实际Native三身份确认 | Host `entry/src/main/ets/app/ReaderRuntimeOwner.ts:2032` |
| 停止态设备快照、覆盖前准入 | Host `scripts/lib/storage-device-evidence.mjs:100`、`scripts/hap-pipeline.mjs:1961,2042` |
| 动效权威请求读取与终态方向ACK | Host `entry/src/main/ets/pages/Index.ets:1429,4452,4493`、`entry/src/main/ets/features/bookshelf/BookshelfNavigationTransition.ets:39,109,268` |

共享Core源码受影响；本轮仅交付HarmonyOS，未构建/安装其他平台。修改保留在main dirty工作树，未提交，其他WIP保留。以下各节是批准时的方案，执行证据与上述实际落点共同构成收尾依据。

## 目标与验收含义

1. 当前本机 Mate 90 Pro 的原v46库由修复后的Reader正常打开、读取、保存并冷重开；书架、进度、书签、高亮、书源、资源归属、同步身份与未决原操作保持正确。
2. 同产品兼容范围内，新旧维护构建可以安全读写彼此产生的数据；验证必须包含恢复、清理、快照和未决操作，不能只有“启动成功”。普通读取通过而写入或原同步恢复被永久关闭，不能记为完整强兼容。
3. 结构迁移游标只用于确定缺失步骤；是否可读、可写及可执行迁移由统一存储合同决定。新增表/索引不自动产生整库不兼容。
4. 任何不能兼容的变化不得借内部游标、安装计数器或产品升号自动获得许可；需另行进入用户批准的产品兼容边界变更。
5. 保留现有数据库、实例、原始证据和所有并行WIP。不通过新VM、清库、卸载、降低PRAGMA、修改数据游标或重置同步身份消除故障。

必须说明的技术事实：已经编译、写死“只接受≤44”的历史包，无法被一个新manifest或新包设置远程改成兼容46。它们是已存在的缺陷产物；需要修订相应维护分支并重建，原字节保留作负例，不能标成兼容通过，也不能再无条件覆盖。后续强兼容必须在结构变化交付之前实现，并由受支持的真实旧构建验证。禁止把“安装拦住旧包”单独算作完成强兼容。

## P0：冻结事实与原数据保护

交付范围绑定主工作树实际dirty输入以及需从同步工作树复用的逐文件前像/差异；采用受控三方整合，保留main已有下载、换源和恢复回执，不能整体替换Core pin或复制另一dirty树覆盖main。

整理已经交付的0.2.0候选、Native身份及实际存储能力。内部v1–47不自动等于47个必须运行的历史产品包；44/45/46/47布局及实际交付维护构建分别登记。历史包缺身份或来源时保留UNKNOWN，不猜测当前库的首次写入者。

当前旧应用的数据库取证必须在覆盖前完成：

- 目标仍为已有本机VM、server `127.0.0.1:8710`；实际target、boot、应用调试身份和数据路径现场复核。所有HDC仍经项目lease并直连。
- 当前候选的官方沙箱路径是HDC `shell -b io.reader.minliny` / `file recv -b io.reader.minliny`，不是Android run-as。它要求相应调试权限及已启动应用，必须先实测可用性；不能预设shell有root权限或停止应用后权限仍在。Host源码的数据目录由`filesDir/reader-core`构造，实际filesDir由平台上下文取得，不能猜物理沙箱路径。
- 首选SQLite Backup API的一致性副本；若只能取文件，必须先真实排除所有写入/checkpoint，再完整捕获DB及存在的WAL和辅助证据。只取主文件、仅比两次stat或对活动原库用immutable=1均不接受。分析和SHM重建在副本上进行。
- 取证不得创建业务Runtime、迁移、回写sidecar、恢复原操作或修复触发器。旧包既没有可用维护入口、官方沙箱通道又不可用时，明确缺证停止；禁止先安装“侦测版”再补称安装前已核验。
- 副本只在本机受控私有证据目录保存，不进入Git、不上传外部服务。后续本地验证复用同一准确副本和快照身份，安装前只有数据实际变化才重新取证。

P0完成条件：可验证的一致性原库副本、实际布局事实、同包名候选与原数据关系明确；原库未被迁移或替换。

## P1：先让修复包兼容现存布局，正常启动不顺带升级

在现有`reader-storage`内建立一个只读检测和准入入口，返回内部`StorageLayoutContext`，包含真实数据库身份、游标、关键表/列/约束/触发器、持久状态形状及当前读写/迁移决策。这是业务存储薄适配，不引入新的数据库引擎或平行迁移执行器。

首批明确处理：

| 实际布局 | 修复后的处理 |
| --- | --- |
| 44 | 使用现有身份/恢复布局；不能访问不存在的同步表，也不能为打开书架自动升级到45–47 |
| 45 | 识别早期同步状态及稳定标记；保留其真实状态形状。若继续某项原操作确需审定的45→46升级，按独立迁移计划执行并保留原操作身份，不能伪称未迁移或已经完成 |
| 46 | 读取宽state行中的epoch、状态、marks和回执；现存46正常启动不升47 |
| 47 | 使用窄clock的权威epoch；验证相应触发器集合，不回退旧state.epoch |
| 缺表、混合触发器、未知关键协议 | 在相关写入前给出具体准入失败；不现场补表、不按游标落在范围就放行 |

统一改动位置：

| Owner/文件 | 改动 |
| --- | --- |
| Core `crates/reader-storage/src/sqlite_backend/storage_compatibility.rs:35` | 复用并扩展事实类型/只读探测；区分实际库事实、候选能力和打开决策 |
| Core `crates/reader-runtime/src/remote.rs:2096` | 用统一准入替代独立`actual > constant`判断；拒绝不能覆盖最后成功写入者事实 |
| Core `crates/reader-storage/src/sqlite_backend.rs:800,860,899` | 普通打开与显式升级分开；普通reader/writer消费同一布局上下文 |
| Core `crates/reader-storage/src/sqlite_backend/prepared_entry.rs:29` | 去掉独立精确schema相等假设；仍保留只读/WAL/query_only与布局条件 |
| Core `crates/reader-storage/src/sqlite_backend/library_export_capture.rs:26` | 只读导出使用同一准入；在同一读取事务中复核布局，不能只复用过期打开结论 |
| Core `crates/reader-storage/src/sqlite_backend/migration_backup.rs:64` | 只有明确升级计划才准备升级备份，不按代码最新常量在普通打开时启动升级 |
| Core `crates/reader-storage/src/sqlite_backend/scoped_search.rs:89` | UDF注册保持必需；派生索引刷新独立决策，不在准入尚未成立时写派生结构 |

sidecar分开保存“最后成功打开/写入的事实”和“本次尝试/失败”。成功记录使用实际游标/状态，不把代码常量冒充实际库版本；失败只追加/替换尝试记录，不降写旧格式代际或丢失旧writer身份。sidecar缺失不等于空库；源数据库及一致性状态为权威。

P1完成条件：真实44/45/46/47副本可按其现有形状打开；当前46冷开、首屏和只读导出可用，普通打开的DDL/user_version不变。未知布局失败不触碰业务数据。

## P2：补齐完整写入和原操作恢复兼容

从同步工作树复用经审计的现有实现，不另写同步算法。整合面包括：

- `reader-domain/src/library_sync.rs`，`reader-storage/src/library_sync_storage.rs`及`sqlite_backend/library_sync_storage.rs`：状态形状、观察凭据、稳定标记、原操作CAS和回执。
- `sqlite_backend/library_metadata_apply.rs:665`及`sqlite_backend.rs::replace_snapshot`：未决同步准入、mark跟踪暂停、恢复后的reset/reconcile与元数据同事务提交。外部恢复和内部补偿分别处理，不能统一清零writer/baseline。
- `library_resource_restore.rs`及现有资源捕获/恢复链：保持资源所有权与同步元数据一致。
- 既有`library_package_v2/sync.rs`、`sync/log_v2.rs`、`sync_projection.rs`及命令路由：使已存在的原同步操作能够继续；只保存pending字节却无法继续，不作为完整修复。
- 普通配置差量写入继续使用现有Config2路径；私有同步journal不塞进普通便携导出。快照/恢复对未知新增域不做隐式整体删除。

epoch只保留一个按布局分派的访问器：46读state.epoch；47读clock.epoch。捕获、CAS、恢复和提交全部使用它。47缺clock不得取旧值、取两者最大值或自动补表；不通过每条业务写入双写宽state行来“兼容”，避免重新引入大同步payload写放大。原有旧包必须通过维护构建修复访问器，不能假称仍能安全读取陈旧列。

P2完成条件：进度、书签、高亮、书源、删除/撤销、缓存证明、导入/恢复、快照、原同步继续和失败回滚均有对应兼容证据；未知新字段/域和未决操作不会被旧形状的整体替换擦除。

## P3：修复迁移本身的数据保留和演进规则

保留现有SQLite/rusqlite迁移函数与Backup API。为现有迁移登记唯一的受控描述：实际前置布局、动作/输入指纹、影响域、是否只重建派生数据、旧读写适配与验证选择器；不重写一套通用迁移框架。

- v8执行前保护旧正文编辑：原文、原键、时间及未知来源完整归档，唯一可证明归属的才转换，其余保持可恢复事实；不能猜来源后挂错书，也不能DROP后只剩整库备份。
- v9无法归属的旧书籍元数据同样保留原始事实与待关联状态，不直接当可丢缓存删除。
- 原已交付迁移定义及指纹保留；在编排边界增加受控保留/修复步骤，已有旧游标库与已经越过该步骤的库分别处理。已经发生的历史删除只能根据确实存在的原备份恢复，不能凭空重建。
- v17/v32/v37等身份/表面变化逐项提供旧访问适配；无法安全适配的实际历史二进制保留失败记录，不宣称兼容。
- 持久触发器限定为内建SQL或兼容范围内所有维护构建都提供的稳定UDF；不能新增函数后默认所有旧进程已注册。
- 同产品兼容范围内保留稳定旧列/表访问语义；新增字段优先可空/有默认，写入只更新所属字段，禁止未经审定的整行替换丢新字段。JSON变化要保留未知事实，恢复/清理要遵守域归属。
- v47拆时钟保留其性能目标；通过兼容访问器/经验证的旧访问接口适配兑现兼容，不再依赖整库拒开作为同版本设计前提。
- 派生缓存可以重建，但有独立策略身份、失效范围和性能预算；不得把原始正文编辑、同步原操作或恢复证据归入可清缓存。
- 当前结构能够安全打开时不强制迁到“最新”。升级由明确计划触发，事务边界、备份、断点和恢复语义有回执；失败不自动还原整库覆盖后续写入。

P3完成条件：含真实旧编辑/元数据的v7及更早夹具升级后无原始事实丢失；已有46/47不重跑历史破坏性步骤；已迁移定义可追溯，新增步骤不得把内部游标变化当不兼容授权。

## P4：一个权威兼容描述，避免再制造协议不兼容

复用现有数据格式代际和迁移游标，补充明确的读写能力/持久协议需求；不再以“最大schema数字”概括全部能力。Core为唯一owner，Host/构建工具消费同一生成结果，不各维护一份版本表。

首个交付载体为独立`storage-contract.v1.json`构建伴随文件，描述实际支持的布局、读写/原操作能力、可执行迁移及其输入指纹；与Core buildId、Native SHA、HAP和manifest共同绑定。它是候选能力声明，不能代替测试或设备事实。

不直接给现有`core.info`/`CoreBuildIdentity`添加字段或capability：`reader-contract/src/core_info.rs:117,136`及`protocol/reader-event.schema.json`是严格闭合定义，capabilities还要求完整列表相等。直接添加optional字段也会破坏某些旧客户端。

构建落点：`reader-runtime/build.rs:78`附近复用现有身份输出链、Native构建/sync-native provenance、Host `scripts/hap-pipeline.mjs::inspectHap/verifyManifest`。保持现有公开v1响应，后续运行时查询采用独立、可协商入口，并且无需先成功创建业务Runtime。

长期维护入口设置在Host的业务Runtime创建之前：取得平台filesDir，停写/关闭业务连接，以Core同一只读检查生成事实和一致性快照；不迁移、不恢复原操作。当前`ReaderRuntimeOwner.ts:1692`先创建Runtime、`:1726`才core.info的顺序不能承担旧库预检；新维护入口不能假装已存在于历史包。

## P5：将数据准入放到覆盖安装之前

修改`hap-pipeline.mjs::resolveDeployment`（约1915）、`deploymentRoute`（1858）、`inspectDeployment`（1947）、`installDeployment`（1967）：

1. 验证不可变候选及与Native一致的存储合同；缺失或不匹配明确停止。
2. `inspect`输出准确目标/boot、应用身份、实际库事实和候选兼容结论；它是观察报告，不是永久许可。
3. `install`在同一次目标租约中建立真实应用写入屏障，取得一致性快照/备份并执行签名与数据两项独立准入。HDC租约本身不是数据库写屏障。
4. 紧邻安装复核同一目标、候选、原应用、数据身份/代次及屏障仍有效；复用同一已验证上下文，不在每层反复全库哈希。事实变化才使准入失效，不能用固定等待时间冒充新鲜度。
5. 安装后核实际Native身份；业务写入前由同一存储准入复核。启动结果至少区分aa启动成功、Runtime ready、书架可读及必要写入成功。
6. 缺证、未知协议、读写不支持均在覆盖前停止；不能先安装再观察报错。失败保留数据与证据，不自动卸载、回滚旧包或恢复备份。

调整现有`tools/test-hap-pipeline-contract.mjs:133`只凭签名允许更新的断言；增加候选能力不足、sidecar缺失/被失败覆盖、实际库/manifest不一致和准入后数据变化的拒绝用例。文档/技能变更在Core governance受控源中完成后再投影。

P5只是防止不兼容包覆盖的防线；P1–P3的实际读写兼容不能由“安装被阻止”替代。

## P6：最小验证集合与执行入口

不运行全量门禁。执行前为下列准确条目登记本轮源码/真实输入/待答问题；已有行为及输入未变的精确证据标REUSED。新增用例名称是本方案拟新增，不冒称现有通过结果。

| 必须回答的问题 | 准确范围及拟落点 | 入口/嵌套/必要性 |
| --- | --- | --- |
| 真实44/45/46/47能否按原布局读写，普通打开不改DDL/游标 | 新增`reader-storage/tests/storage_compatibility_contract.rs`；`existing_layout_reopens_without_migration`、`schema_change_after_admission_rejects_write` | Core `check-local.mjs --stages workspace-tests`精确选择该target/case，sqlite feature；只编译相应Cargo target/依赖，不带其他套件 |
| v46实际书架/进度/标记、首屏/导出是否保留 | 同target `schema46_preserves_reading_and_sync_facts`、`prepared_and_export_readers_share_admission` | 使用P0准确库副本；普通读写与隐蔽只读入口都需覆盖 |
| v47是否使用正确clock且不回退宽行写放大 | 同target `schema47_cas_uses_narrow_clock`；复用已有大payload/1916行准确场景 | 旧epoch故意落后，确认CAS和回滚；只复验受时钟适配影响的性能路径 |
| 未决同步、恢复和快照是否保持原操作 | storage精确pending/CAS用例及Runtime现有sync/restore聚合target中的受影响case | 覆盖有pending拒绝恢复、原操作继续、无pending外部reset和内部reconcile；不发起新的真实远端同步替代原操作 |
| 旧迁移是否保留用户事实 | 同target `legacy_edits_are_retained_before_source_migration`、`ambiguous_books_remain_recoverable` | 用真实旧生产DDL/夹具创建v7等输入，不能把新库PRAGMA改小充当旧库 |
| 失败元数据是否污染最后成功事实 | 现有`storage_compatibility`及Runtime对应精确测试，增加`failed_open_preserves_last_successful_facts` | 覆盖格式代际更高、sidecar缺失/损坏、拒绝后再次打开；不把未知代际默认为1 |
| 同产品新旧维护构建是否真正双向兼容 | 用冻结的真实二进制/维护构建依次“旧写→新读写→旧读写→新冷开” | 校验字段、身份、原操作、未知域及恢复语义；历史坏包是失败负例，不能修改它的测试结果或用同一新实现假装两代 |
| 覆盖前是否真实拦截能力不足 | Host具名pipeline数据准入用例、目标事实/屏障seam | 不调用设备的控制器测试；签名相同但数据不兼容必须STOP，其他门禁NOT_RUN |

故障注入只落在已改变的事务/迁移提交点，验证中断后前一步事实保持、重开不重复删除、不遗失原操作。重复运行仅因相关代码/输入改变或新失败原因。

全部必要本地验证通过后，只构建一次对应Native和规范signed HAP：复用已确认Cargo缓存，`hap-pipeline.mjs build --class iteration --contracts-scope none --signing local`，仍核指定minliny_HarmonyOS身份、bundle和immutable manifest。不以构建顺带触发其他套件。

## P7：回到原VM完成闭环

原VM先完成新的覆盖前存储准入，再安装同一manifest绑定产物。最小现场场景依次为：

1. 原v46数据正常打开，原书架及既有进度可见，正常打开不把游标升47。
2. 对已选原书做一次位置保存与冷重开；核原标记/身份及未决记录保持。没有明确待答问题不触发真实同步或全库恢复。
3. 已安装包确认为本次Native、Runtime ready，随后恢复原任务的书架打开/合上、真反向、主题与减少动态效果测试；精确帧时间仍需要合格采集，不拿截图耗时替代。

源码、定向测试、Native/HAP、签名、安装、Runtime、数据读写、动效与用户验收分别记账。任何一步失败保留原失败和用户数据，先回代码定位，不新建VM或反复安装制造机会。

## 交付完成条件

- 当前原v46库的可用性恢复，功能读写与冷重开通过，不靠清数据/改游标/换实例。
- 首屏、导出、恢复、原同步及全部实际改变的存储owner共用同一准入；不存在残留单常量精确相等暗门。
- 已知迁移保留用户事实；同产品兼容矩阵真实通过，未知新域不会被旧写入、快照或清理抹掉。
- 旧缺陷产物不能再次被无数据预检覆盖；新能力描述与实际Native相符，公开旧协议未被顺带破坏。
- 同产品范围内的后续存储变化先通过兼容实现与双向验证，再允许交付；不是写完迁移、抬游标后依靠拒开兜底。
- 本次不通过提升产品版本获取不兼容许可，也不自动扩展其他平台的产品版本、构建或设备安装。共享Core影响范围需记录，平台交付按实际授权分别进行。
