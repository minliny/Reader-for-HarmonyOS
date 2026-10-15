# 全工作树集成范围（2026-10-15）

用户授权“全部合并”。本轮基于完整注册清单核对 HarmonyOS 37、Native Core 31、UI 23，以及仅一个工作树的 Swift Core、Android、Windows、iOS，共 95 个注册路径。

本轮接入统一 Action Sheet、下载持久意图与 Runtime 生命周期恢复、文本/图片联合存储预算及清理（设置文字清理、下载页和VM验证共用策略，历史未知清理只读核对而不重放）、目录状态/上下文与实际搜索投影、平台简介溢出测量和显示专用封面回退。保留现行书籍身份、源版本、租约、325章进度保护、目录重试、固定头与底栏、按设备容量预算及 bounded policy 批次；不得以旧工作树覆盖这些后继实现。

提交历史连接以逐个变更审计、当前语义接入或明确后继替换为依据。重复实现只接入一次。旧设计、独有文档和无生产入口的诊断保存在 `docs/history/worktrees`；旧 onComplete 几何诊断不得再承担首帧/进度提交，也不证明 GPU 绘制。远程音频阅读/下载不会从历史分支恢复。

原工作树没有被删除、清空或重置。13个 prunable 注册路径的现存提交对象可恢复，已丢失的未提交文件不能伪造恢复；原始 tar、index 和源码快照保留在工作区的私有 evidence/source-preservation，签名/Profile/密码不进入 Git。其他单工作树平台没有额外分支要合并；Android 现有用户删除保持原样。

源码接入、完整测试、Native/HAP、安装、VM 功能、真机与用户验收分别记账。本文件记录接入范围；本轮最终验证与每个原工作树的 SHA 清单见工作区外部 `all-worktree-integration-20261015` 证据目录。

## 需核对历史连接的 HarmonyOS heads

- `80ccdc338d7b37e5c70f9a02d3eb0d4d2a95ddb4`：PATCH_EQUIVALENT_HISTORY_JOIN
- `c21a2d78528628354efee88329eb7ad314fc52bc`：PATCH_EQUIVALENT_HISTORY_JOIN
- `01270e278f2555f9896f4dcb33f5c654d8f758d8`：PATCH_EQUIVALENT_HISTORY_JOIN
- `8d00af5b7bb66c9249d1b7aec3523240e5d4d91f`：SEMANTIC_RUNTIME_PLUS_GEOMETRY_AUDIT
- `6fbe0a6c78c2d89b6577415cb16f536085d424fa`：SEMANTIC_RUNTIME_PLUS_GEOMETRY_AUDIT
- `4b7c19784c43fdab742e2128ee38a728e99cd072`：SEMANTICALLY_ABSORBED_HISTORY_JOIN
- `0c225539fc0ac010d8478ae0c79dcc560431722a`：SEMANTICALLY_ABSORBED_HISTORY_JOIN
- `e1e3f7a97bff9fa74d02eaf4a1268b9a9eb9f90d`：SEMANTICALLY_ABSORBED_HISTORY_JOIN
- `8b9851023cbdca30b4696ef221638811c3550fd5`：SEMANTIC_RUNTIME_PLUS_GEOMETRY_AUDIT
- `e356c0594b15297ea7d3cfa0896aa63a0cbc6db8`：ADAPTED_IN_PRIOR_INTEGRATION_HISTORY_JOIN
- `e74ef51e10da90570ea3a12587ae3373a5f0eaba`：ADAPT_CAPABILITIES_REQUIRED
- `c263f0432a9e16e87502ad2d2aea4ee43d7ed01c`：SEMANTIC_HISTORY_AND_SOURCE_ARCHIVE_REQUIRED
- `7e1a84a686966c8db41c11fac5ce6713080bea37`：SEMANTICALLY_ABSORBED_HISTORY_JOIN
- `5f140ec980247c52416d27a02aa2cc0e96207837`：SEMANTICALLY_ABSORBED_HISTORY_JOIN
- `151dfb5d71b9d552b302327ddd36f30757ccbd56`：SEMANTICALLY_ABSORBED_HISTORY_JOIN
- `c000882d7616b6947ba06f1d5e62688489db13aa`：SEMANTIC_RUNTIME_AND_HISTORICAL_ASSET_REQUIRED
- `8b0096f893e5c022975aecd313ecffd2d2f509fd`：SEMANTICALLY_ABSORBED_HISTORY_JOIN
- `05834698a89bc2b3f5f4e285e659d48bc9db1e39`：PATCH_EQUIVALENT_HISTORY_JOIN
- `45f7f31959f9f9f7e1eb6a81eca681526f3a6f7b`：ROOT_POPUP_INTEGRATION
- `0c9be9e58e5d3a7d2bdc9557792351741a8148b5`：SEMANTIC_RUNTIME_PLUS_GEOMETRY_AUDIT
- `5c1f9086df3955f83db242af9737d7049717f6c0`：SEMANTICALLY_ABSORBED_HISTORY_JOIN
