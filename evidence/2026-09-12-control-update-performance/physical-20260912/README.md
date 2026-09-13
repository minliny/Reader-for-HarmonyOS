# 真机定点证据（2026-09-12）

- targetRef：`b1f20b88963d`；候选：iteration manifest `20260912T095612Z-9abd21a7-7eab6704`，signed HAP SHA-256 `296f6638b646a75f31c03a2c49ed0e20a4415eb28b4a38b0ebcb843bd22fcdf5`。
- pipeline inspect/install/launch：PASS；数据策略为 preserve。
- 书架→正文：点击命令约 3.27s 返回；约 800ms 采样已进入正文，后续正文稳定。
- 控制栏展开：中心点击后，约 150ms 采样已出现完整控制栏，约 300ms、1000ms 保持稳定。截图触发时间是 probe 主机时序，不是 VSync 精确帧。
- 控制栏收起：真机 UI 树确认按钮中心约 `(1120,1698)`；命令约 7.1s 返回。采样期间出现系统来电浮层，控制栏在采样中保持可见，不能归因于应用收起失败；本项保持 OPEN。
- 前两次 probe 因 `Connect server failed` 停止；重新确认设备在线后，使用 8710 server 端点成功完成上述展开采样。
- 证据边界：代码/本地回归、HAP 交付、真机传输、真机画面、用户验收分开记录；本目录不宣称 Figma 或用户验收通过。
