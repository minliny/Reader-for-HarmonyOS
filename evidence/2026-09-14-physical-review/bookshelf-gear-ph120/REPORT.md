# PH120 删除书架列表齿轮并右对齐剩余工具

2026-09-17。用户在核对More与列表齿轮职责后明确：“删除齿轮按钮，其他按钮右移”。这是对旧工具栏分组入口决定的更新，不扩大为顶More或应用设置变更。

## 实施范围

- 普通`BookshelfPage`和`BookshelfEmptyPage`的“我的书架”工具条均删除齿轮，剩余宫格、列表、筛选三项。标题原有`layoutWeight(1)`占据余量，三个按钮按原间距自然右移，末端与原工具条右边界一致，无空占位。
- 删除已失去入口的分组选择栏、展开状态及`BookshelfViewState.groupExpanded`。挂载时清空旧`readerBookshelfSelectedGroup`瞬态过滤，正文、书籍分组及Core用户数据不改。普通列表只消费阅读状态/类型条件，批量选择继续共用同一可见集合。
- 保留顶More四项和书架设置页，平板侧栏“设置”不属于本次删除对象。
- 基线为PH119 run `20260917T120215Z-5fb96de4-61c06cf2`，已于本日20:29:13安装启动于既有Mate80Pro VM；Harmony/Core均保留之前dirty工作。本轮不改Core/native、不清理用户数据。

## 验证与交付

适配既有书架回归，检查普通/空态三按钮、右对齐容器、筛选/模式切换和旧分组状态消除；随后执行官方iteration构建及manifest复验。沿用用户本会话“完成后安装到VM中”的明确授权，产物通过后在重新确认的同一既有VM保数据更新。各层结果随后记录。

- 已适配7个既有脚本，9项相关检查PASS：filter-responsibilities、viewport-return、view-and-menu、management、physical-feedback、detail-control-stability、legado-product-logic，以及未改动的tablet-navigation、more-layout。
- 实际SDK Builder确认普通/空态各3个按钮，标题弹性布局和工具Row无固定占位；52帧按钮状态稳定性通过。返回状态探针确认旧分组过滤被清除，阅读状态/类型不变，冻结的书籍group字段不变。`git diff --check` PASS。
- 原有管理入口断言按用户新决定移除，并非删除失败用例来保留旧行为；新页继续覆盖模式切换、筛选和More。未新增测试文件或通用算法，复用既有组件布局和SDK探针。
- 源码/测试已冻结，官方iteration构建开始。尚无本轮VM安装结果；本地SDK属性及回调证据不能代替VM像素或用户验收。

## 最终结果

- 冻结后的296项Harmony检查、完整ArkTS编译、隔离无增量HAP构建、本地debug签名均PASS。独立官方manifest复验与Core→Host→包内native溯源PASS；PH117 Core 9项源码输入未漂移。
- run `20260917T131505Z-5fb96de4-3d029ccb`；manifest（原始证据仅本地保留）。signed SHA-256 `c419891971331e45d072d7f8ffe4073a682da7448b6b5f5a2cb95a45a5493e94`；签名已验证，Profile为debug。
- Harmony `5fb96de4cf322c9b4f35c558051ba1fea5196ad5` / Core `bf49495317798f68b98928712eb6e106af02bed1`，保留既有dirty；本轮iteration，`acceptanceEligible=false`。raw native `71c84f7d172a18b0d2a92be219f7a325209ba51dbcb75495013b44c70506abd5`，embedded `8510666f3586adf09a8b59f6d315c42560f6b45cbad90a7ae1851abdf62134d0`。
- 重新发现的唯一在线VM仍为Mate80Pro、Emulator PID99447，实例为原目标设备，回执仅本地保留；HDC 连通。启动标志true，当前实例日志的Guest OS Boot Completed为2026-09-16 08:45:16.131；SceneBoard PID1538/1955均持续运行约1天9小时55分，启动故障扫描无结果。共享HDC租约串行，官方安装持目标锁。
- `inspect`确认与既有Reader签名身份一致；**北京时间2026-09-17 21:16:30**保数据覆盖安装及启动PASS，安装前后身份相同。原目标设备，回执仅本地保留。锁已正常释放。
- 无卸载、清数据、VM重启/替换或真机操作。VM安装/启动通过；本轮没有额外页面输入或截图，VM视觉/交互及用户验收仍OPEN。
- 证据文件：`hap-build.log`、`hap-verify.log`、`iteration-provenance.json`、`final-delivery-verification.json`、`vm-boot-completed.log`、`vm-sceneboard.log`、`vm-boot-error-scan.log`、`vm-inspect.log`、`vm-install.log`。
