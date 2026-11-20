# 书源工作流原型

当前产品由 Index 挂载 SourceManagementPage。此目录保留未挂载的筛选草稿与 Apply、分组成员操作、导入预览、原始写入确认及恢复的独立夹具。夹具引用在用的产品模型、网关和标准组件。产品入口不依赖此目录。

- test-reader-filter-controls.mjs 和 test-ui-dimension-budgets.mjs 观察原型的 SDK Builder、属性与布局方法。
- test-source-group-management-flow.mjs、test-source-group-empty-domain.mjs 与 test-source-import-owner.mjs 观察实际模型和原型 owner。网络与 Core 写入端口用受控夹具。
- message-entries.json 记录原型沿用的消息、恢复和逐项结果职责。
