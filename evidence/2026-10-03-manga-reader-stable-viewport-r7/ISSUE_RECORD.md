# R7 漫画全窗口图片视口与浮动控制

用户反馈（2026-10-03）：R6 VM 沉浸阅读的上下仍有空白；唤起控制栏时图片重新排版，未在原图片位置上叠加控制栏。R6 run `20261003T132254Z-568ec4e3-d6c1d5d4`、signed SHA256 `0c57c7221e3a7612bf764c471655d120f3d37fe63e7f003c8a93a7b5d837bff7` 的冻结证据保持原样。本项是用户实际视觉失败；上一轮静止显隐检查没有覆盖全窗口图片及显隐前后像素位置，不能代表本项通过。

先从代码定位：MangaReadingSurface 把 readerInteractiveSafeInsets 放在包含 imageViewport 的整个根 Column 上。即使原生系统图标已隐藏，cutout/gesture insets 仍留空间；显隐导致 system/navigation insets 变化，stage与Scroll面积改变，resizeViewport 改 viewportHeight 并 restore，contain 图片进一步重算比例。Index reading edge branch显式top padding为0；Shell没有第二个显式安全区padding，但二者只expand绘制safe area，需检查layout-safe原生约束。Coordinator当前为漫画写不透明纸色系统背景；Shell外层目录/换源也画实色 status underlay，因此还有遮住图片的纸带。

修复范围：图片Canvas保持全窗口同一布局，系统栏显隐仅影响overlay安全区；漫画系统栏背景透明、App退出恢复原策略。常驻页码、章末、平板目录与弹窗互动各自避让；scrim全窗口；不改Core/Native、书源、章节身份或阅读设置。采用本机API23已有原生安全区布局能力，不另造管理器。

验证顺序：产品代码与真实SDK Builder/状态回归先行；冻结allowlist、源码增量与canonical signed包绑定；仅在SDK不能证明的native约束、实际空白和图片像素位置上用已授权VM取证。最小场景为同一话同一页 immersive→controls→面板→close→immersive；比较无遮挡漫画区域及同一图像bounds/原图锚点；退出恢复。共享VM先确认占用和当前启动状态；保留应用数据、不卸载、不操作真机。

验收：代码原因已定位；修复/SDK/构建/VM/用户验收分别待记录。R4/R5/R6冻结档案不修改，新记录均在R7。
