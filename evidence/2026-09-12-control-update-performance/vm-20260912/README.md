# VM 定点证据（2026-09-12）

- 目标：本轮 iteration signed HAP，manifest `../..//.reader-artifacts/hap/20260912T095612Z-9abd21a7-7eab6704/manifest.json`，targetRef `6460677a198b`。
- 安装：pipeline receipt 记录 `install=PASS`、`launch=PASS`、`dataPolicy=preserve`；不代表功能验收。
- 展开采样：中心点击后，`expand-160ms.png` 已出现完整控制栏，`expand-1000ms.png` 稳定；probe 时间原点是 HDC 命令启动/截图触发，不是 VSync 或 native 事件时间。
- 收起采样：`uitest uiInput click 1120 1760` 的命令耗时约 1.4s；0–1000ms 截图在命令返回前，不能作为应用收起动效证据。`collapse-before-command-return.png` 与 `collapse-after-1000ms-scheduled.png` 保留原始证据。
- UI 树：展开前后的布局回读保留在 `open-layout.json`、`after-collapse-layout.json`；不能单独证明像素或触控命中。
- 证据边界：代码/本地回归、HAP 交付、VM 安装启动、VM 画面采样、用户验收分别计账；本目录不宣称 Figma 或用户验收通过。

## 2026-09-12 重启后复验

- DevEco 设备管理器启动现有 Mate 80 Pro，Emulator 记录 `Guest OS Boot Completed!!`；HDC target 为 `127.0.0.1:5555`，targetRef `6460677a198b`。
- 候选 manifest `../.reader-artifacts/hap/20260912T103957Z-50cad401-bacf9041/manifest.json` inspect、保数据覆盖安装和启动 PASS，receipt：`../.reader-artifacts/hap/20260912T103957Z-50cad401-bacf9041/deploy-vm-6460677a198b-20260912T113048Z.json`。
- PTY probe 曾受 HDC `Connect server failed` 影响；本轮改用非 PTY 串行 harness。`retest-20260912-harness2/` 完成布局/截图回读；`retest-20260912-collapse/` 收起点击约 195ms 返回且截图已隐藏控制栏；`retest-20260912-expand/` 完成 0/160/640/1000ms 展开采样，约 345ms 出现控制栏，640ms 后画面稳定。
- 这些时间是 HDC 命令触发/回读时间，不是精确 VSync 或原生事件时间；长帧、连续 MOVE、反向翻页、Figma 和用户验收仍未关闭。
