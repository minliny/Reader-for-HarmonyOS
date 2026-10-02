# Phase 2 Dialog 纵切执行回执

日期：2026-10-02
工作包：WP04 Dialog（第一条生产迁移纵切）
分支：`feat/phase2-dialog-20261002`
worktree：`/Users/minliny/Documents/Reader/.reader-isolated/phase2-dialog-20261002/Reader-for-HarmonyOS`

## 起点

本 worktree 从干净的 Dialog 候选 `0c225539fc0ac010d8478ae0c79dcc560431722a` 分出，并带入 WP00 回执 `ec12262726b3e9b0f0ce3d54565d1bb2593dd452`。没有从 Host 主树复制 85 项 dirty，也没有接入 Core 主树的 46 项 dirty。

当前候选的三个同规格真实消费者是：删除确认、JSON 导入和书架默认分组。连续导入 `LocalImportDialog` 仍由 WP09 负责；系统 `showAlertDialog` 属于平台宿主合同，不混入自绘 Dialog 家族。

消费者和排除项的逐文件清单见 [`PHASE2_DIALOG_CONSUMER_BOUNDARY_20261002.md`](PHASE2_DIALOG_CONSUMER_BOUNDARY_20261002.md)。

## 本次推进

候选原有的共享 `ReaderDialogSurface` 只把 `bodyActionsOwnMargin` 暴露为 helper 读数。本次补充真实 Builder probe 的节点级断言：

- 删除确认的 30vp 间距必须写在唯一的内层 body `Column` 上。
- 外层 framed root `Column` 不得收到该间距作为外边距。
- JSON 导入和书架分组必须各自保留空的内层 body margin，不得继承删除确认规格。
- 这些断言在同一候选的不同窗口宽度/规格重放中保持成立。

这一步只增强验证，不改变当前应用视觉基线，也没有把第三阶段的视觉细调提前混入迁移。

## 已执行验证

| 命令 | 结果 | 证据边界 |
|---|---|---|
| `node tools/test-book-removal-dialog.mjs` | PASS | 真实 SDK Builder probe、状态回调、三规格节点级间距与变体隔离 |
| `node tools/test-json-import-dialog-real.mjs` | PASS | JSON 草稿/校验/关闭链、共享规格传播和宿主接线 |
| `node tools/test-responsive-surface-widths.mjs` | PASS | Dialog 与页面横向几何静态回归 |
| `node tools/run-contract-tests.mjs --source` | PASS，174 个 source，236 个 integration 分类 | Host 源码合同；不代替 SDK/HAP/VM/视觉/用户验收 |

另外通过四项静态交付门禁：`test-hap-pipeline-contract.mjs`、`test-native-input-preflight.mjs`、`test-build-input-safety.mjs` 和 `test-hap-source-inputs.mjs`。这些只证明输入、签名身份绑定和流水线防护仍可执行，不生成新的 HAP，也不改变当前 VM 安装。

曾在默认沙箱下运行 `node tools/run-contract-tests.mjs --full`。该套件在 `test-reading-directory-fixture.mjs` 启动本地 fixture 时被执行环境拒绝监听 `127.0.0.1`（`EPERM`）而停止。随后在同一隔离 worktree、同一输入和受控回环监听权限下重跑规范 `node scripts/hap-pipeline.mjs build --class iteration`，全量 `check-local.sh` 通过；最终 source 计数为 174、integration 分类为 236，ArkTS、HAP 打包和签名也通过。第一次失败作为环境边界保留，不能被删除或改写成代码通过。

## 产物和 VM 证据

最终构建：

- run ID：`20261002T065307Z-4a7734d3-e9e8990a`
- manifest：`.reader-artifacts/hap/20261002T065307Z-4a7734d3-e9e8990a/manifest.json`
- signed HAP SHA-256：`2be3509aa6ca4f60807648e8aca5a786e59a2d7c68e02ebc10a437668b5eb2e6`
- 证书 SHA-256：`3a563778e5bf17cd3ead0218e13b4a5030de3f5d7d4e21e0336d8eb37b676dc4`
- manifest verify：PASS；签名为 `minliny_HarmonyOS` debug profile，bundle 为 `io.reader.minliny`
- VM inspect：PASS，目标 `127.0.0.1:5555`，target ref `6460677a198b`
- 保数据安装和启动：PASS；部署回执为 `.reader-artifacts/hap/20261002T065307Z-4a7734d3-e9e8990a/deploy-vm-6460677a198b-20261002T065434Z.json`

同一安装运行了 UI probe，并取得当前应用效果基线、书架菜单、设置、书源管理和 JSON 导入表面的布局/截图。证据目录为 `/Users/minliny/Documents/Reader/evidence/2026-10-02-phase2-dialog-vm/`，机器回执为 `phase2-dialog-vm-receipt.json`。JSON 导入表面在书源管理的“新增书源”入口真实打开；空在线地址真实显示校验错误，关闭后返回书源管理。

## VM 数据边界和未关闭项

本次保数据 VM 的 Core SQLite `user_version=34`，而候选携带的 Core 只接受到 28。因未获准卸载、清数据或改写用户数据库，书架和书源页面显示真实的加载失败/重试状态，VM 没有可用书籍供打开删除确认或默认分组编辑。因此：

- 删除确认和默认分组已经完成源码、Builder、ArkUI 编译和候选接线验证，但本次 VM 交互分别记为 **OPEN（数据前置不兼容）**；不能把 JSON 导入一条 VM 证据扩大成三条。
- 19 个系统原生 `showAlertDialog`、持续 `LocalImportDialog`、Sheet/Popup 仍按消费者边界文档排除，未声称已迁移。
- HAP、安装启动和 JSON 导入表面的设备证据已闭合；删除确认、默认分组的设备交互、视觉比较和用户接受仍待拥有兼容 Core 数据的保数据目标后补验。

## 未关闭出口

WP04 的源代码纵切、消费者边界、全量本地合同、ArkTS/HAP、签名、VM 安装启动和 JSON 导入交互已经有可复核证据。由于保数据 VM 的 Core schema 不兼容，删除确认和默认分组的真实设备交互、三消费者完整视觉比较和用户接受仍未关闭；本分支可以作为完整候选保留，但不能把它标为“所有出口已闭合”，也不应在当前主树 dirty 状态下直接合入。
