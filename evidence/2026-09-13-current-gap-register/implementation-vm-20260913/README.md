# 首包 VM 交互证据与后续修复

目标为已运行的 Mate 80 Pro，HDC 127.0.0.1:5555。包 manifest 位于 `.reader-artifacts/hap/20260913T125821Z-2df5cfa6-7c0928b6/manifest.json`，signed HAP SHA256 为 `a13af1f730f718198f6a82b3f90aea5028f526e8a8430d05446123683150d345`，Harmony `2df5cfa6` / Core `952704bd5` clean。该包独立校验、签名兼容检查和保数据安装通过；部署回执 `deploy-vm-6460677a198b-20260913T134341Z.json`。没有卸载、清数据、重启或替换 VM。

统一本地门禁为 Core 3726、CLI 210、Harmony 220 组通过；日志 `/private/tmp/reader-final-delivery-gate.log`，SHA256 `9d2d14c3fb19175efca7f9d0eadba0de4cba6ae8d3bfc5de8a13f47f64d20039`。后续221组日志先于设置圆角与取消导航细化，不作为四项修复的最终统一门禁。

已观察：原四本书及列表配置仍在、普通与批量列表、75%宽实色单书菜单、顶More三动作、筛选展开与小更新按钮、轻量默认分组、正文、快捷控制、自动翻页快捷启动/暂停、朗读快捷和完整页启动/暂停、0.50倍速入口。JSONL保留逐操作回执，PNG完整性通过才算有效截图。五张采样不是连续视频，不能据此判断3500ms全帧流畅度。

四项现场问题均先代码定位并修复，等待新包VM复验：空作者行折叠 `d6a08fc5`；快捷自动翻页越界 `594cee9e`；书籍信息导航及失败取消 `8d2ea1f3`；设置分组圆角被矩形裁剪覆盖 `3cf395d7`。详见本目录各 observation/回归记录及相邻 auto-quick/settings-rounded 审计。

文件名不等于验收结论：`tts-full`、`full-open` 是操作未进入完整模块时的Home画面，真正完整朗读是 `tts-full-2`；`full-tts-restored` 是点击整颗胶囊后的播放态；`book-more` 是动效中间态，稳态看 `book-more-settled`。`reader-control-settings-quick.png` 带多余尾部，是拒收证据，详见 `capture-integrity-stop.md`，其布局JSON单独通过完整性校验。

完整控制收起/滚动、完整自动翻页、主题/刘海、导入/搜索、所有翻页模式和触控故障矩阵等仍需继续同包验证。物理设备、连续视频、GPU/120Hz、物理亮度/音频、历史失败书源逐现场归因及用户验收保持各自OPEN。
