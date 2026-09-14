# PH75 协议与位置作用域独立复核

本记录只覆盖 Core 协议 schema、合成合同 fixtures、真实 Rust DTO 往返及只读门禁复核。PH75 正文/所有位置事务与 Host 集成由各 owner 的生产回归另行证明，不能以本记录关闭完整迁移、VM 或用户验收。

## 合同落点

- `chapter.content` 新增 `upgradeCachedContent`（默认 false）和 `positionContext`。后者包含精确 `bodyVersion`、`processingVersion` 及最多 128 个 `{id, offset}`；offset 为 Unicode scalar。缺失/重复身份、越界位置和内容版本真实性继续由 Runtime 对存储事实验证。
- `ChapterContentData.positionMigration` 定义 `committed`、`unchanged`、`preserved` 三种状态、前后正文与处理版本、Host 请求锚点的前后坐标及可选已提交 progress。`unchanged` 仅用于两种版本均相同；`preserved` 表示仍返回旧正文与位置，不表示升级成功。
- `ReadingProgressData`/`ReadingProgressUpdateData` 可附当前行被证明的正文/处理版本；更新参数可带 `expectedBodyVersion`/`expectedProcessingVersion`。旧客户端未提交版本并不被协议层伪造版本，迁移后写入准入仍由 Runtime/Storage 负责。
- `RemoteContentPositionScope` 包含 source/book/chapter/bodyVersion/processingVersion，接入书签、高亮、正文搜索结果及书签/高亮 create/update 请求。未知或有歧义的归属可以缺省；不允许缺少 scope 内部必需字段后静默退回旧协议。
- 两 schema 补齐以上定义；补上原先未细化的 bookmark/highlight create/update 参数绑定，以及 chapter/progress/search/highlight 的结果 data 映射。结果 envelope 无 method，本次用 method→definition 映射验证结果 data，未仅检查“data 是对象”。

代码：`Reader-Core-Native/protocol/reader-{command,event}.schema.json`、`crates/reader-contract/tests/remote_content_position_contract.rs`、`protocol/fixtures/conformance/positions/*ph75*.json`（21 个合成样本）。不包含真实书源返回或用户书签内容。

## 检查与失败保留

- 仓库 schema linter：290 fixtures，unexpected invalid/valid 均 0，见 `PH75-contract-schema-lint.json`。
- 使用已安装开源 `jsonschema 4.25.1` 的 Draft 2020-12 验证两 schema 自身及命令/具体结果 data；21 fixtures 加 4 个非法结果变体共 25 例通过。验证脚本 `PH75-contract-schema-verify.py`、结果 `PH75-contract-schema-results.json`。未新增或修改通用 schema 验证器。
- 既有 strict contract drift 检查通过，见 `PH75-contract-schema-drift.log`。
- Rust 正式合同回归包含新旧参数兼容、正文迁移/进度/书签/高亮/全文搜索结果的真实 DTO 序列化往返、无符号位置和不完整 scope 拒绝、所有相关参数及结果 schema 的可达绑定。末次 `cargo test -p reader-contract --offline` 为 517 项、14 suites 全部通过（含新增 5 组），见 `PH75-contract-all-tests.log`；随后 `cargo clippy -p reader-contract --tests --offline -- -D warnings` 通过，见 `PH75-contract-clippy.log`。
- 第一次 5 组定向测试中 4 组通过、1 组失败，实际揭示 `ChapterContentData.http=None` 序列化为 null 后自身反序列化不接受；已由 DTO owner 修为省略 None。原记录 `PH75-contract-initial-http-null-failure.log`。
- 后一次全 contract 运行碰到测试对 `hasMore=false` 必须原样保留 JSON 字段的过严断言；生产 DTO 明确允许省略该默认值。测试已改为校验 typed 全字段往返相等，不改变生产分页行为。原记录 `PH75-contract-default-omission-failure.log`。不能把这两次失败隐去，宣称首轮全绿。

## 独立只读门禁发现与交接

1. 当前 bookmark/highlight create/update/list 和 reading.progress.update 已有 source publication guard；scope 读端根据精确正文/处理投影出具，不把全局书名匹配本身当成内容身份。不能仅看字段存在就认定原子性已证明。
2. 旧正文投影曾使用新请求 `chapterTitle`，而读取 scope 使用旧缓存 `body.title`。标题去重处理会改变可见正文，旧锚基准必须统一取旧 title。已交给 Runtime owner，并收到旧/新 title 分离修复及回归补充确认。
3. 进度 LWW 可能保留另一章的新记录；响应必须使用实际 stored 行的章与版本，不能返回请求章版本。已交 Runtime owner，最终修复/回归状态以其报告为准，本记录不代替代码验收。
4. owner query 中直接 JSON 字段过滤与 OR book_id 可能扫描书库；已交 Storage owner核对。其已确认补 title/author 表达式索引及 book_id 索引，has_migrated 改为 indexed owner→精确 chapter PK，读 scope 改为轻快照，并回报 EXPLAIN 通过；本次未重复修改或自行宣布该性能门禁通过。
5. **处理配置改变后的历史坐标版本归属仍须独立证明。** 对持久 offset 仅重算当前 processingVersion 并返回，会把旧坐标误标成新投影身份。该项已由 Runtime owner 报给根任务统一处理；协议字段可承载真实证据，但字段定义本身不能解决证据来源。不得在其修复/验证完成前宣称所有旧坐标均已安全迁移。

本切片未修改 PH75 Runtime/Storage 生产文件、设备数据，也未运行 HAP/Native 构建。
