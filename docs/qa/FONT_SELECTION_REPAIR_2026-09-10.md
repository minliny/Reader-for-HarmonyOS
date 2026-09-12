# 字体库选中态修复（2026-09-10）

字体选中态修复已完成 HAP／VM 交付。首轮 105602Z 包完成 8 个内置字体与关闭重开检查；后续 115401Z 包已保数据安装，搜索与换源列表均为 73 个书源，Quick/Full 字体端点复验通过并恢复宋体。搜索总分组数 306→273 的原始条目守恒审查仍开放，不将本轮结果扩大为全部 demo 验收。

## 最新同包交付：搜索身份修复与字体端点复验

- [Manifest](../../.reader-artifacts/hap/20260910T115401Z-35f2f99a-0c294e4c/manifest.json)：`20260910T115401Z-35f2f99a-0c294e4c`；signed SHA-256 `67aa059747a68e2c14fde57dab43313989edde0584b21a3bcf80b7f7341538fa`。174 组完整 Host 检查、ArkTS、无增量构建、输入漂移门禁及独立包复验通过。11:54:44 UTC 复核 494 项源码输入与快照一致，搜索冻结的 12 文件一致。
- [部署回执](../../.reader-artifacts/hap/20260910T115401Z-35f2f99a-0c294e4c/deploy-vm-6460677a198b-20260910T115600Z.json)：11:56:00 UTC，在同一现有 VM、同一签名身份下保数据安装并启动；未卸载或清数据。继续沿用 `7551947...` Rust Core NAPI，未将并行 Core 迁移源码编入该库。
- 正常搜索停止在 36/190、失败 6 个书源。首本搜索结果、换源列表初次与稳定后、返回搜索均为 **73 个书源**；列表加载标签 opacity 为 0，两次列表布局哈希一致。详情、关闭换源及返回后的简介均为 208 字符，SHA `3782bd2141c6b3617276a1a930debd2d18d210f190abd372237fdd196253a31a`。
- 返回仍保留“全部”过滤器及停止进度；总相关书籍组从 306 变为 273，搜索任务正在检查共享身份归并后的原始条目守恒。暂不声称总分组数保留或发生丢书。
- 新包字体端点：Quick 宋体、Full 宋体、改选黑体及恢复宋体均只有一个选中填充；原始 PNG 四角与边缘检查通过。本次未重跑首轮全部 8 字体、关闭重开或连续动效逐帧矩阵。
- 短流程前后 Reader PID 为 26246，新增故障文件 0。RSS 595888→492728 KiB；guest 报告的 VmHWM 也下降，因此仅保留原始观测，不作高水位或长期内存结论。
- 探针于 12:06:26 UTC 正常退出并释放锁；应用留在原 EPUB 的完整“界面”控制页，宋体已恢复。随后翻页／控制相关源码继续变化，见机器记录中的 `currentSourceDriftAfterDelivery`；这些后续变更不属于此包。

完整同包记录：[vm-verification.json](../../../evidence/font-selection-20260909/vm-delivery-20260910/search-identity-followup/vm-verification.json)。私有数据库及原始缓存条目继续只保存在用户批准的 Git 忽略目录，公共记录仅含计数、哈希与本轮 UI 证据。

## 修复范围

`ReaderControlAppearanceContent.ets` 的 fontCell 由内部 Row 绘制背景、边框与 12vp 圆角，外层继续承载原动效裁剪、几何和输入。原问题是同一绘制节点上的矩形 PathShape 覆盖了选中背景圆角。本次没有修改并行任务的控制层动效实现。

## 首轮字体完整矩阵交付（105602Z）

- [Manifest](../../.reader-artifacts/hap/20260910T105602Z-35f2f99a-6964e6db/manifest.json)：`20260910T105602Z-35f2f99a-6964e6db`，iteration，`acceptanceEligible=false`。
- signed SHA-256：`a7b9ad725542e1e6ece8aa20071e7e6d48ce65c3c0c9da67c971a3e908be53f4`。独立复验通过，debug Profile，证书指纹见 manifest。
- [部署回执](../../.reader-artifacts/hap/20260910T105602Z-35f2f99a-6964e6db/deploy-vm-6460677a198b-20260910T110219Z.json)：2026-09-10 11:02:19 UTC，现有 Mate 80 Pro VM，targetRef `6460677a198b`，保数据覆盖安装及启动通过，前后应用签名身份一致。
- Harmony `35f2f99a8d635615475fde75120bf8629f944565`、Core `6b2a9d87048e3da812bec08b7c2b3fff1c16e2e2`，均为共享未提交工作树。172 组 Harmony 检查、ArkTS、无增量构建、签名与独立包复验通过；构建后 492 项输入哈希一致。
- Core NAPI 沿用上一轮已交付二进制：源库 SHA `7551947ee98fc5079b2b715aaa9f0f4742901d767450e888c69a955d33fed2ac`，包内 SHA `059a147cb172ebbb458516c14036df205d6feb64d5cf9590071a931343c60464`。本轮未重建 Rust NAPI；并行 Core 位置迁移源码没有编入该包。

## VM 结果

| 检查 | 结果 |
| --- | --- |
| 快捷界面初始宋体与改选黑体 | 唯一选中，圆角正常 |
| 展开完整控制页 | 保留黑体选中，圆角正常 |
| 完整页系统、宋体、黑体、楷体、仿宋、等宽、思源宋体、霞鹜文楷 | 8 项逐项切换通过；原生布局唯一填充、原始 PNG 四角及边缘检查通过 |
| 关闭后重开“界面” | 保留已恢复的宋体，圆角正常 |
| 短搜索→详情→换源→返回 | 简介文本一致、停止状态保留；书卡 73 与换源 61 的差异稳定复现，未通过 |
| 本轮短搜索流程健康 | Reader PID 未变，新增故障文件 0；RSS 432496→508152 KiB，不能据此声明长时内存稳定 |

真实截图和检查：[原始记录目录](../../../evidence/font-selection-20260909/vm-delivery-20260910/)。主要证据是 `reader-control-font-quick-initial.png`、`reader-control-font-quick-sans.png`、8 张 `reader-control-font-full-*.png`、`reader-control-font-reopen-appearance.png` 和 `native-font-selection-checks.json`。搜索实际返回证据为 `reader-control-search-returned-results.*`，不得按其他采集中间文件的名字推断页面。

完整机器记录：[verification.json](../../../evidence/font-selection-20260909/verification.json)。共享 VM 仅在上一任务正常释放后接手，本任务探针于 11:21:43 UTC 正常退出并释放锁。用户明确批准的一致性数据库副本只保存于 Git 忽略的私有目录，用于搜索计数诊断；公共记录不含数据库或原始候选行。

## 证据边界与历史

本轮关闭字体选中态的正常 VM 端点验收；连续动效逐帧对齐、物理机、自定义导入字体、长期压力与用户验收仍开放。旧包 73/61 差异在最新包上已变为 73/73；总分组数变化仍由搜索任务审查，不能把本轮交付称为全部 demo 能力验收通过。

旧 `20260909T160635Z-35f2f99a-f0153d91` 候选曾因 9568332 未能安装，其记录保存在 `vm-delivery-20260910/verification-before-vm-delivery.json`。签名身份问题已由统一交付任务处理，本轮只执行同身份保数据更新；旧失败记录不再表示当前安装状态。
