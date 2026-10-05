# 漫画沉浸阅读 R8：代码与原生数字验收

2026-10-04（Asia/Shanghai）。本轮完成 R8 构建、保数据安装和数字取证；整个问题仍为 **OPEN**，不能报告“顶部色带已修复”或“全屏验收完成”。

## 已通过的范围

R7 已修复的原因包括根布局安全区 padding、系统栏显隐导致的 viewport resize/restore，以及漫画背景被原生栏和 Shell status underlay 覆盖。R8 保持该实现，新增默认关闭的原生 Image 数字探针、生产几何判定和 SDK 回归，并修正探针的 ArkTS 显式类型。R8 没有裁切图片或用固定负偏移遮盖顶部区域。

- 当前 canonical 构建通过 438 项 Harmony contract、实际 CompileArkTS、隔离非增量构建、绑定源码与 Native 输入、指定签名检查及独立 verify。
- 当前源增量可由 R4 → R5 → R6 → R7 → R8 v3 重建；全部 2,433 项 canonical 构建输入匹配。原持久 worktree 中其他 actor 后续改变的文件不属于本 HAP，不予覆盖或自动回退。
- VM `127.0.0.1:5555` 已通过 canonical 保数据 signed update 与启动，部署回执 `dataPreserved=true`。
- opt-in 冷启动进程 `25061` 的首张图片 decoded receipt（sequence 2）为本地 offset `(0,0)`，content/component 都为 `1280×524`，Image Area global origin `(0,0)`。实际生产 validator 判定本地目标矩形通过。
- 已稳定的沉浸 A、控制栏 B、再次沉浸 D：七个 Image、对应 ListItem、List、Scroll 的 actor 和 `origBounds` 一致；根视口为 `[0,0][1280,2832]`。A/D 的可见图片矩形连续覆盖窗口顶部到底部。
- B 的可见边界 top=137，原始边界仍是 top=0。该树结果支持系统栏遮挡与布局移动的区分，不能外推为逐帧合成证明。
- 普通冷启动进程 `26139` 进入同章漫画图片页，挂载七个 Image，精确 PID/guest-time 区间内无新增诊断记录，默认探针关闭路径通过。

## 未通过的范围

首张图片 decoded 回执与 viewport Area 的 state generation 不一致；B/D 只有此前保留的 decoded 回执。保留回执不能充当当前状态的新回执，所以严格 phase association 仍为 OPEN。真实 `onComplete` 是解码后的目标几何回执，发生在提交重绘之前；全部记录的 `submittedPaintEvidence=0`。本轮未强制重新解码、替换 actor 或修改 validator 来制造通过结果。

此前观察到的顶部约 72–80px 浅色带，尚未确定是输入内容、codec/pack/二次解码结果，还是最终原生绘制阶段造成。生产链排除了人为首 tile 偏移、分块缝隙、宽度适配的行内居中、沿用占位高度及 graphics 目的区顶部漏绘；原生数字结果进一步排除了当前样本的 Image 内部目标矩形留白。这些证据仍不证明源像素或提交帧的颜色。用户拒绝提取图片缓存，本轮未读图片、缓存、数据库、源像素或截图。

`code-runtime-check/check-native-runtime.mjs` 按真实输入执行，exit=2、`acceptanceStatus=OPEN`，保留上述通过项与未决项。第一次 A 树采样时末块尚未挂载，原始 `vm/a.json` 保留；稳定样本另存为 `vm/aSettled.json`，没有重写早期观察。

## 交付身份与证据

- build class：iteration，Harmony/Core 均 dirty；不具备 clean-workspace acceptance 条件。
- Harmony commit：`568ec4e32a2bdce01f62724cfb04a3f6b5a63a60`。
- Core commit：`dfd729cffd79ed11da6d44be9e1ba10c4223247f`。
- run：`20261004T002116Z-568ec4e3-3eec7853`。
- signed HAP SHA-256：`9b5f34be522060a84bb4e2e805e62ca538cc0d2ae4d68f1a81f716cdf2c1ac56`。
- manifest SHA-256：`555eaba03fe4c3c130352c42ca4929763cc1ff039bd7f59ee1adde31b0293712`。
- 签名：唯一指定 `minliny_HarmonyOS`；证书 SHA-256 `3A563778E5BF17CD3EAD0218E13B4A5030DE3F5D7D4E21E0336D8EB37B676DC4`，包名 `io.reader.minliny`。
- [构建及部署结果](canonical-delivery/RESULT.json)、[原生数字结果](vm/runtime-result.json)、[源码到产物绑定](source-delta-v3/canonical-binding/REVIEW.md)、[问题记录](ISSUE_RECORD.md)。全部失败构建和修正过程保留于 `canonical-delivery/ATTEMPTS.json` 及原始日志。

已结束全部 VM/HDC 会话并释放目标租约，最后确认时 VM 留在 R8 普通启动的同章漫画阅读态。未恢复架构任务的旧包，旧 PID/旧 HAP 的运行证据不能用于 R8，反向亦然。真机、其他场景、完整源像素/提交帧及用户验收均未宣称通过。

## 最后补充

[系统绘制源码审查](rs-source-review/REVIEW.md)已结束：官方两版的节点树与 Surface dump 没有逐 Image 的提交/送显回执；[actor 关联审查](rs-actor-bridge-review/REVIEW.md)也不能把现有 UITest ID 直接当作 RSNode ID。当前 VM 是否同实现未另行验证，未再占用 VM。提交帧和浅色带来源继续 OPEN，现有证据不足以支持裁边或固定上移。R8 实际未采目录 C，该场景不由本阶段验收。

本轮重建的五个 Rust debug 缓存目录已先审计后清理，排除保留硬链接后候选分配空间为 1,106,358,272 bytes；必要 CLI 保持原 SHA 且清理后 `--help` 通过。源码、Native、HAP、证据未删除。详情见 [清理补充记录](/Users/minliny/Documents/Reader/evidence/2026-10-04-manga-task-storage-cleanup/post-r8-build/REPORT.md)。
