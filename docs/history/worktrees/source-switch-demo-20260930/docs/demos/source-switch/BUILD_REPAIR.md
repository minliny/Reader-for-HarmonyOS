# 原生 demo 构建阻塞定位

## 2026-09-30：完整门禁被外层超时中止

- 现象：规范 signed iteration 构建在 120 秒后终止，未产生 manifest 或 HAP。
- 触发：`ed0b03c2` 上执行 pipeline，外层 Python 对整条流水线施加 120 秒截止时间。
- 证据：`hap-gate-120s.log` 最后仍为通过的合同测试；日志中没有编译器错误，尚未启动 Hvigor。`scripts/check-local.sh` 逐个串行启动所有非 server 的 `tools/test-*.mjs`。
- 直接原因：外层截止时间覆盖全部串行门禁与构建，主动发送 SIGINT；不能据此诊断 ArkTS、签名或 VM 故障。
- 已审计：pipeline 顺序、门禁枚举、原始日志、入口隔离。正在检查测试文件隔离性及 Node 内建测试执行器，保留原有全部测试和失败退出语义。
- 未决：完整门禁能否在两分钟内完成；正式 ArkTS 编译和签名是否成功；原生 VM 视觉与交互尚未验证。

本记录仅针对本地隔离分支，不修改主工作区，不更改证书，不操作真实阅读数据。

## 修复与局部验证

- 门禁复用 Node 内建 `node:test`，4 个独立进程，保留相同文件发现与 server 排除规则；整批以 `AbortSignal` 限定 120 秒，任一失败、取消或文件未执行均返回失败，不进入打包。
- 3 项负例探针原先写入固定 `/tmp` 文件，改为唯一临时目录，并用 `finally` 清理，避免与其他工作区的检查相互覆盖。3 项合计 7.15 秒通过，残留 0。
- 执行器的隔离 fixture 验证完整枚举、带空格文件名、新失败文件自动准入、失败退出、超时取消。首次 fixture 发现 stdin 的 `--input-type=module` 被子进程继承，已改用普通 CommonJS stdin，复验通过。
- 页面真实 SDK 语义及 ArkTS 1.1 linter 检查无错误；此结果仍不等同正式 Hvigor 编译。

## 新现场：共享 Core 分支已变化

- 再次启动 pipeline 时在 import 阶段失败：`scripts/core-source-snapshot.mjs` 不存在，未进入门禁。
- 现场主 Core 已为 `codex/local-integration-20260930` / `bcce4c7a1`；demo 原来链接主 Core，原生包身份仍为 `e2a2db0b1f6b2d9a4300c2577eaae4155bddef2f` + dirty 输入。
- 修复方向：从 Git 留存的原输入恢复独立 Core worktree，并逐项核对原生包记录的 868 个文件及身份；不改动当前主 Core，不修改原产物证据来消除不匹配。

恢复完成：原 WIP 提交 `98a0df4a6` 的 868/868 文件与包内 source snapshot 完全一致；独立目录保留原 HEAD `e2a2db0b1` 和真实 dirty 工作内容。原始包/证据独立复制后 `verifyCorePackage` 和 `assertCoreInputs` 均通过，见 `core-isolation-recovery.json`。

## 首轮并行全量门禁：发现三个缺失的隔离输入

- 版本：`ed0b03c2` + 本记录中的未提交门禁修复。整批耗时 97.51 秒，384 项全部执行，381 通过、3 失败，0 取消、0 跳过；没有进入 Hvigor。
- `test-reader-platform-paragraph-probe.mjs` 依赖未跟踪的历史 evidence 原型文件。将原文件逐字节收进 `tools/fixtures/platform-paragraph/`，测试指向该受版本控制的夹具；SDK 断言不变。
- `test-reading-assistant-source.mjs` 缺独立目录中的既有 Core CLI；这是两个离线元数据 fixture 的执行器，不是待交付 HAP Native。
- `test-theme-dynamic-icons.mjs` 的 generator `--list` 提前读取 sibling `Reader-UI/theme/registry.json`，但枚举实际只用本仓 ETS/资源。将色板读取移至只读枚举返回之后：枚举不再依赖无关仓库，生成/校验颜色仍读取原色板。
- 原始失败日志保存在 `.reader-local/source-switch-demo-repair-gate-failed.log`。

三个失败项局部回归均已通过。图标测试另外在没有 sibling Reader-UI 的临时 Host 目录中执行真实 `--list`，验证枚举结果；CLI 已独立复制并记录自身内嵌身份，见 `test-input-recovery.json`。这些修复不删除或跳过原断言。

## 最终结果

修复源码提交 `85bd874af3978fc254b476774a27a16e99c92b4c`；完整规范 signed iteration 流水线通过：

- 384/384 合同通过，0 失败、取消、跳过，93.11 秒。
- 正式 ArkTS 编译、Native 构建、打包和签名成功，Hvigor 37.11 秒。
- 输入前后快照、Core Native 来源、包内 Native 集合、书源字节、签名及 manifest 校验全部通过。
- `minliny_HarmonyOS` 证书 SHA256：`3a563778e5bf17cd3ead0218e13b4a5030de3f5d7d4e21e0336d8eb37b676dc4`。
- Run：`20260930T134349Z-85bd874a-be8b8f52`。可交付 signed HAP 的完整身份见 `signed-build-result.json`。

仍有非阻断编译警告，包括本 demo 的 `ObjectLink row` 警告（现有搜索页也有同类警告）；未把成功编译提升为原生响应式绘制或交互验收。现有 VM 仅完成本轮只读就绪检查，没有安装/启动；VM 视觉、滚动锚点、动效以及用户验收仍 OPEN。

所有修复只在 demo 分支，未合并、推送或修改主工作区。原生签名包的源码身份以 manifest 记录的 `85bd874a` 为准，后续文档提交不改变该产物身份。
