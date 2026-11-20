# HAP 保留策略与安装标记生命周期

## 问题与修复

2026-10-24，正常阅读修复的开发构建在编译前被 `10 protected runs plus 1 new run` 阻断。旧策略将历史部署的回退包和未核销安装标记持续保护，最终占满 10 个名额。用户授权优化后继续实施。

新策略保留上限 10 个成功构建：显式 pin 和正在操作的 run 优先，其余按完成时间滚动。历史部署回执不再自动固定包。没有活跃 run owner 的安装标记在取得对应锁并复核后归档，保留原字节、哈希和核销原因；未知安装结果仍是 UNKNOWN。

清理移到编译、签名、验包全部通过之后。发布锁串行化规划和发布，run 锁保护安装与删除互斥；取得 run 锁也经过发布锁，因此确认死亡的 run owner 可以安全回收。未知 owner、活跃 owner、陈旧发布锁仍拒绝抢占。只删除 manifest 所属且哈希匹配的 HAP，保留源码快照、manifest 和部署证据。没有改变签名身份、设备选择或保数据规则。

受控规则同步自 `Reader-Core/governance/workspace/HAP_BUILD_SYSTEM.md`，工作区投影只更新 HAP_BUILD_SYSTEM.md。本次没有为清理扩大门禁、提高包数量或修改设备数据。

## 精确验证

| 入口 | 本次必要范围及结果 |
| --- | --- |
| `node tools/test-hap-retention.mjs` | PASS：真实生产规划/清理方法，临时合成包；滚动上限、显式 pin、历史部署不固定、标记归档、哈希/符号链接拒绝、无效候选不删旧包、有效候选发布。无其他套件。 |
| `node tools/test-hap-retention-install-race.mjs` | PASS：真实子进程/run 锁，安装与删除互斥、不同 run 可继续、孤立标记复核、死亡 owner 并发回收。无 HDC 或真实安装。初次测试夹具的目录删除参数错误及竞争时短暂未写 owner 的预期未覆盖，修正后通过；生产仍保守拒绝无可读 owner。 |
| `git diff --check` | PASS；仅空白差异检查。 |
| `node Reader-Core/scripts/sync-workspace.mjs --write` | 28 项投影，仅本次受控 HAP 文档 1 项更新；不附带业务测试。 |
| `node scripts/hap-pipeline.mjs build --class iteration` | 最终 PASS：完整 ArkTS 编译、签名、包内容/来源校验；contracts none，全量业务测试 NOT_RUN。 |

对应两项 gate-index 的测试定义哈希与说明随已审定策略更新，没有删测试或改成无条件通过。

## 实际操作和失败证据

- 首次 `prune --keep-runs 10 --apply` 仅归档 3 个无活跃 owner 的安装标记，删除 0 个包、0 字节，结果均 UNKNOWN；原标记来自 20261013T132056Z、20261020T111343Z、20261023T141242Z 三个 run。
- 优化后第一次构建：编译/打包/签名成功，但构建中源码变化，发布前拒绝，没有清理旧包。回执 `hap-attempts/1792773229427-51115181-fbff-48cb-a7e1-4bf4388bfa11/stages.json`。
- 第二次：共享工作树设置页消息预览的 Builder 语法和 `enabled` 属性冲突导致编译失败。日志 `.reader-artifacts/reading-open-retention-20261024-build2.log`。复查时当前工作树已经修正为独立 Builder 和 `previewEnabled`；本任务未覆盖设置页修改。
- 第三次成功回执 `.reader-artifacts/hap-attempts/1792773473505-c90a3555-7d05-4e8a-a46b-ed381a56dd77/stages.json`。
- 构建期间共享目录新增 `retention-pins.json`，包含 9 个显式 pin，说明为仅替换未安装中间包。本任务保留此配置，未解除 pin。最终发布删除中间 run `20261023T163635Z-6b1bd753-64fb4e59` 的 HAP 共 434254001 字节，保留其证据；发布后仍为 10 个有包版本（9 固定＋1 滚动），没有残留安装标记。本次不能报告为已启用无固定项的“最近 10 包”。

## 成功产物与证据边界

Run：`20261023T163829Z-6b1bd753-64fb4e59`。

Manifest：`.reader-artifacts/hap/20261023T163829Z-6b1bd753-64fb4e59/manifest.json`。

Signed HAP SHA256：`a67f3ae4bdeac01a83f1258bf532903ecdf3ff8c87586feec78cf5b9e34ee025`。

Harmony：`6b1bd7534b61a8ebfac10150fd308eae8430606e` dirty；Core：`9131ddcfeef1922620c6867f88fe82608e51a079` dirty。绑定输入 fingerprint：`64fb4e5936bb3a0431baf1a15de2d542aee0ca6a718dd3d38817bb83a186ddff`。共享 WIP 如实记录，不能称为单一功能的干净发布包。

证书核验为指定 `minliny_HarmonyOS`（`3A563778E5BF17CD3EAD0218E13B4A5030DE3F5D7D4E21E0336D8EB37B676DC4`），debug Profile。安装、运行、阅读交互和用户验收均 OPEN，本任务没有访问设备或清理应用数据。
