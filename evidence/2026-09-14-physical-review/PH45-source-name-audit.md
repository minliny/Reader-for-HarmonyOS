# PH45：书源名称误判删除的代码审计

用户在已安装643bcaf5上看到《终宋》的书源为“书源已移除”；初始记录见FOLLOWUP_43_47.md。本任务未读取设备书库，因此没有该书sourceId、对应源记录或该次运行日志，不能宣称其源确已删除或个案已恢复。只读当前代码和已有证据，不操作设备/构建/Git，不改主题/详情Hero/TTS。

## 修前已定位的通用问题

1. `ShelfBookPresentation.source`将缺名、URL或与ID相同的不可用名称直接映射为“书源已移除”；缺少名称本身不能证明删除。
2. `Index.sourceDisplayName`只查三个内存列表，未加载/失败为空时也返回删除文案；`applyBookshelfState`把“名称暂不可用”当正常名称，可覆盖已缓存可读名。
3. `Index.hydrateShelfSourceNames`把成功source.list中未匹配ID推断为删除。`SourceGateway.loadSources`会跳过缺name字段的条目，且异步读取没有独立请求代次/owner准入；旧列表结果有机会覆盖新的名称/删除事实。Core `source_names_for_ids`则按持久source_id精确查询，不依赖全源列表；runtime只有该查询明确缺行才返回“书源已移除”。应保留Core这一明确事实，不能让部分列表或内存未就绪替代它。
4. `BookshelfPage.bookRowRenderKey`未包含sourceName；新对象被hydrate后，外层ForEach可能保持旧行Builder及其book参数，继续显示旧名称。

修复范围：显示未知文案、Index源名选择/补全及其请求门禁、现有行key；不改sourceId/bookId、不按书名或网址猜测身份、不改Core数据。先补真实生产行为红绿，随后只按上述已定位问题修改。来源名称未匹配和《终宋》具体为何进入该状态仍须分别记录。

## 已完成的限定修复

- `entry/src/main/ets/features/bookshelf/ShelfBookPresentation.ts:5`：缺失、URL或ID名称统一显示“书源名称暂不可用”；Core传来的明确“书源已移除”仍原样显示。本地格式标签不变。
- `entry/src/main/ets/pages/Index.ets:419,2398,2415,4840,4854,5083,5128`：书架进入阅读/详情时携带该书的持久sourceName，不只读取可能尚空的内存源列表；临时未知不能覆盖已缓存的相同sourceId可读名称。Core当前持久名称及其明确删除结论优先。
- 同一Index名称补全链：source.list仅补全精确匹配、可读名称；缺项/畸形名称/读取失败保留当前事实。请求序号、runtime owner、书架加载代次及已准入数组引用均匹配才应用；当前Core已确认删除的源不能被迟到列表复活。重新导入必须先有新的Core书架事实，不能按书名猜测改绑。
- `entry/src/main/ets/features/bookshelf/BookshelfPage.ets:1173`：现有行内容key加入sourceName，使仅名称变化的行更新。原sourceId/bookId身份、位置锚与布局保持原语义。

Core `reader-storage/src/sqlite_backend.rs::source_names_for_ids`仍按持久source_id精确查询；`reader-runtime/src/remote.rs::shelf_source_display_name`的明确缺行→已移除语义保留。未修改Core、SourceGateway、BookshelfFlowGateway、持久存储或源身份。业务投影与生命周期复用既有生产方法，无新增通用匹配引擎或依赖。

## 本地回归与冻结

新增 `tools/test-shelf-source-name-resolution.mjs`：真实SDK提取Index、SourceGateway和BookshelfPage生产方法，直接调用ShelfBookPresentation；修前8组失败、修后8组通过。覆盖缺名/明确删除区分、持久名透传、临时未知不覆盖缓存、真实SourceGateway过滤后的空列表、异步反序、删除后迟到列表不复活/新Core事实允许重新导入、owner及代次失效、名称独立更新行key。合成书仅用于控制身份与异步顺序，不伪称《终宋》设备数据。

红绿原始日志：[PH45-production-red.log](PH45-production-red.log)、[PH45-production-green.log](PH45-production-green.log)。关联七项全部PASS，原始输出：[PH45-related-tests.json](PH45-related-tests.json)：

1. `test-bookshelf-source-name-durability.mjs`：补齐真实稳定owner/初始字段；删除旧的“source.list缺项等于持久删除”错误预期，仍保证Core明确删除、源身份隔离、旧wire兼容和进度保留。
2. `test-surface-repair.mjs`：缺名预期改为未知，其他导入/持久化/呈现回归保留。
3. `test-dynamic-list-refresh.mjs`。
4. `test-bookshelf-viewport-return.mjs`。
5. `test-bookshelf-reading-entry.mjs`（含书籍信息保存失败/重试与逐层Back真实链）。
6. `test-bookshelf-detail-removal.mjs`。
7. `test-window-flicker-dedup.mjs`。

生产3文件、测试3文件（新增1、更新2）已冻结。没有执行全量门禁、构建、Git、VM或真机操作；当前物理设备仍是用户反馈的643bcaf5，本修复未作为已安装或视觉验收通过记账。

## 《终宋》有限历史检索与个案边界

用户表示不知道原书源；不再要求用户回忆。按先文件名命中、再定点读字段方式查了Harmony evidence/HAP记录及根evidence/Core文档证据：

- `evidence/2026-09-12-control-update-performance/physical-20260912/expanded-layout.json`（Harmony仓）历史布局包含“终宋”及“第45章 智斗 · 在线书源”；没有sourceId/bookId/sourceName业务字段。只能证明历史展示，无法对应当前643bcaf5书架记录。
- 根 `evidence/tts-end-to-end/20260912-iteration/physical-install-20260912/before-tts-layout.json`也有同名UI文字，未提供业务身份。
- 根 `evidence/local-book-chain-repair/results.json`、`positions.json`及`evidence/opensource-implementation/corpus-comparison.json`中的同名项是《终宋》EPUB本地语料，不能据此把当前在线书改绑为本地书。9/13总账快照的同名命中也是本地解析审计。

个案尚缺当前书架条目的(sourceId, bookId, sourceName)与同一时刻该sourceId的持久源记录是否存在、其name值；据此才能区分Core明确删除、源名不可用和Host旧标签未刷新。当前没有这些设备事实，不声称真实书源已删除，也不声称《终宋》已恢复；通用代码缺陷已修并本地回归，个案身份与真机结果仍OPEN。没有扩大设备授权或安排取证。
