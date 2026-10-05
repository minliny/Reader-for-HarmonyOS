# R8 漫画持久化源码兼容性审查

审查时间：2026-10-04。方式：只读源码、Git 状态、官方构建 manifest/snapshots；没有读取 VM 数据库、漫画缓存或源图片，没有 HDC、测试、构建或产品修改。本报告限定普通漫画同章读取与现有进度保存/控栏退出，不是全应用回退兼容声明。

## 比较输入及产物归属

A：`/private/tmp/reader-full-architecture-delivery-20261003-1845/Reader-Core-Native`。架构任务引用记录：`/Users/minliny/Documents/Reader/evidence/2026-10-03-full-architecture-execution/r0-r8-closeout/CURRENT_ARTIFACT_20261004.json`。

记录引用 canonical manifest `/private/tmp/reader-full-architecture-delivery-20261003-1845/Reader-for-HarmonyOS/.reader-artifacts/hap/20261003T234214Z-38dc049d-8373cd62/manifest.json`，schemaVersion 2，SHA-256 `349ea71733b9040c4f46cdc7707e9085f74e2d1b35009b1d0df84b6014ffa43a`，signed HAP SHA-256 `d352111a12f69a7ed6d4e5a6f48b54488ce217eafbe906066f122d794ac396fe`。Core HEAD `9e5b032b488f09c80c2ad6435faef495e94f95d2` / tree `7105638b615d0784126c2005dc3460d3233dd633` / clean 均与记录相同。source-snapshot fingerprint `8373cd6236d1260362c4507e220bbe4ffbe4301054ec7042db27aafcf1a73bb3`；controller-snapshot fingerprint `5e11f990bf86693edc044905d0bef980ecfcb88285d85da23725021a48e59f63`。这些构建记录不等于本审查重新确认现场安装或数据库内容。

B：`/private/tmp/reader-manga-sheet-ui-delivery-20261003-1913/Reader-Core-Native`。HEAD `dfd729cffd79ed11da6d44be9e1ba10c4223247f` / tree `0bda8ac6ee77394adff65437f4ffaf82efe21d18`，dirty 候选；比较按实际文件字节而不是仅 HEAD。

## 比较事实

下表路径相对于各 Core 根，哈希为本次实际文件 SHA-256。

| 路径 | A | B | 结论 |
|---|---|---|---|
| crates/reader-domain/src/manga.rs | e9fbcd7d1c3ccaf7a618866924926bb4ab8b00c207379ffb4643f072b200f777 | 同 A | 整文件一致，包括 Manifest、Location、page identity、display hints、mapping |
| crates/reader-storage/src/manga.rs | 7e4221b47c4f67a8d4f4cd75e7f80fa0d92bddf95bec9be26e6e96e4cf01ccda | 907c9ef1af4d654c755ce0a29adbaa49f33eec04dc9a34dd4c5e449e2cd60308 | 持久 DTO 段一致，B 增加 read_time 与 in-memory shelf last_read_at |
| crates/reader-storage/src/sqlite_backend/manga.rs | 80c1f121b6237157f01fa02df75d92a0d5ae91966d840e7a229c84b87a149a15 | 0e152ed7a219781ce477c5e98b0a6c472c992465bfd2b5197a2ea1a9ede2d72a | v29–31 迁移一致；B save 增加既有列/clock 更新及 restore clock 维护 |
| crates/reader-storage/src/sqlite_backend/manga_entry.rs | e09580c00409900b86dcae00bf6a4c43b95135b8e421086f339ca6a12ae04bd8 | 同 A | 整文件一致，包括 v32 索引及 prepared entry |
| crates/reader-storage/src/sqlite_backend/manga_decode.rs | fba05959b243aaabf21d41c2833146c013c9ee987d5f6f92c4dd253d16a83613 | 同 A | 整文件一致 |
| crates/reader-storage/src/sqlite_backend/manga_switch.rs | 5c1bf90ab7e3c64e7cffff8e76f30e107ac820ab68e7b5793f06a4a0e99ff679 | 同 A | 整文件一致 |
| crates/reader-runtime/src/remote/manga.rs | 02dc32711c79ebdd4b826d4b54c313ed7390daf35f6fe908f5875dcb21671a02 | 010f43635c28705faf192f865bfb57f7c413cfbf416d86efe1140f520b9b1ae7 | B CacheFirst 对已变源规则执行既有 refresh/CAS 路径 |
| crates/reader-runtime/src/remote/manga_decode.rs | b9793c2562928c52957816f9696359fc11ac78e163de47ade5a5d12336c36d2b | 同 A | 整文件一致 |
| crates/reader-runtime/src/remote/manga_inspect.rs | bfce229e7cc5efd9c3912ecbced345c52a7a4126e3124b4ad82adae6b4f04261 | 同 A | 整文件一致 |
| crates/reader-runtime/src/remote/manga_switch.rs | 3a20784f0631063cddc6c242928aa60cdc7b4004647d44a8ddb2f0bca9a71ec1 | 同 A | 整文件一致 |

`sqlite_backend.rs` 从 `pub const SQLITE_SCHEMA_VERSION` 至初始化/完整 migrate/lock 段逐字相同，段 SHA-256 `268763117adfae384599a7c4af3d16a9e2bda6862d1b62925b7b47af692d560e`。两侧支持 34；current==34 时不新增 DDL，>34 时拒绝，不能据此猜现场实际版本。

v27 shelf projection 迁移仅注释差异（移除注释和空行后代码一致）；v29–31 manga migrate 段逐字一致；v32 manga_entry 整文件一致；v33 catalog_index 整文件一致（`a977e590cc2507ccccc1a97a0143e4ea600d2cc7b2fa42505f1c3211e5871812`），remote_content_positions 的 migrate_indexes 段逐字一致（`b249260fc5322d1a136d7941cc2e9efaa78901a4550e7724eddedcbb9aaf10e5`），directory_revision 既有文件前缀相同，A 后增方法不是迁移差异；v34 admission trigger/migrate 段逐字一致（`68f87b7ffbbab3513cc21a18dc7525f809fab0bd67015b44e32890492feb3293`）。migration_backup 整文件一致（`578301009cf7afdf861f91fc5a916b61a0bf141974994c7faf521ac441d7d974`）。

MangaManifestHead/Snapshot/ProgressToken/ProgressState 持久 DTO 段一致（`a90394b343426337168f6546e02e085ef8d06db98feea8e39afb461bb199c2a6`）；check_progress 段一致。reader-contract/remote.rs 的 MangaResourceData→FirstImageReceipt→ReadPolicy→ProgressUpdate/Get→Entry DTO 段一致（`547f798c642cd8d22a527890091056079778a78d9a92bd548d151d3e2b976725`）。

## 普通保存路径及覆盖范围

Host `MangaReadingSurface.ets:621` saveVisible→`MangaSessionController.ts:361` savePosition→`MangaSessionGateway.ts:107` reading.progress.update(kind=manga)。Surface panel action 在 :1258 冻结/保存当前已确认位置后关闭，真实退出在 :790 走同 action；:1164 openPanel 同样仅调用现有 saveVisible。

Core A `remote.rs:11207` 先按 kind=manga 路由到 manga::update_progress，绕开新增小说/操作 receipt 分支。B `remote/manga.rs:387` update_progress→sqlite_backend/manga.rs:422 save_manga_progress。读取 payload 为完整 MangaLocation，head/manifest 校验和 epoch/revision+1 CAS 后在单事务内写入该 source/book 的完整 payload。B 另更新既有 bookshelf.last_read_at 及既有 reader_shelf_projection_clock；不覆盖其他 bookshelf 列，不写/删除 manifest、admission 或架构新 receipt cache 键。

MangaLocation 同一八字段模型：kind、chapter、manifestVersion、pageId、pageOrdinalFallback、x、y、progressRevision；chapter 的 source/book/chapter identity 亦一致。MangaLocation/Manifest 均 deny_unknown_fields；未知字段会解析失败，不能静默吞掉再保存。A 未引入 B 不认识的新漫画持久字段。

B 的 CacheFirst stale-source 刷新是已查明行为差异：它重走既有 immutable manifest 发布/CAS，保留旧 manifest 与旧进度、生成 mapping；Host 若同章/恢复意图位置无法精确映射则 requiresRecovery，:372 阻止普通 savePosition。源版本函数只是复用同样 canonical Source JSON 的 SHA256，没有新持久字段。此项不能被描述为所有源变更均可无感恢复。

## 结论和保留边界

SOURCE-SCOPE PASS：在上述两份已比较源码、有效 schema34 与已认识的漫画持久结构前提下，正常同章读取/已确认位置保存/控栏退出不存在“把架构版本新增漫画字段丢掉”的代码路径。此结论不只是 schema 常量比较，而依赖 DTO、DDL/迁移、交易写集与 Host/Core 路由一致性。

架构 Core 新增读时、WebDAV、操作、RSS、规则 receipt 能力，B 并未完整认识；本报告只证普通漫画保存不触碰它们，不认可全应用任意旧入口、导入/备份恢复、同步或未知数据库数据的全面兼容。B snapshot restore 有批量替换逻辑，未纳入本次普通读取保存准入。

OPEN：当前现场 installed artifact 的独立确认、实际数据库 user_version/内容、未知 JSON、真实网络源变更后的恢复和保存行为。没有通过读取用户 DB/缓存补齐这些项，没有设备操作或测试执行。不能将源级判断替代 artifact/device/user acceptance。
