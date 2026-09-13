# 搜索历史首次进入全部折叠：记录与代码定位

## 发现时的事实（修复前）

- 产物：第三包 acceptance `20260913T160039Z-9509d4fe-25529e1f`；Harmony `9509d4fe`，signed SHA-256 `b9ef64ece51c02c865ca1740fee52ca7efebe162495fb784fa000fae1aacf2fd`。
- 触发：从书架首次进入搜索页面，未触键盘、未提交查询（root 本轮操作记录）。
- 现象：仅有“最近搜索”与“1条更多”，历史 chip 全空，区域落在屏幕中部；只有一条历史不应全被折叠。
- 既有证据：
- `reader-control-r9509-1789315814956-search-page.json`：42691 bytes，SHA-256 `63906b87ec1a4529b3fdcfb21d3649d5ffc4504d721f55286c48e4d047131eaf`
- `reader-control-r9509-1789315814956-search-page.png`：126621 bytes，SHA-256 `eaecd3140d12a7b3c5e2cbf8f654a48a38d3be84e7f16e35b9c9f71a1799a37f`
- 当前结论：已记录 VM 现象；根因待检查生产宽度测量、onAreaChange 响应、历史打包与实际 Builder 链。
- 未决点：VM 空历史与中部定位是否同一原因；新包代码回归不能代替修后 VM 像素。
- 本任务不操作 HDC/VM，不重复抓屏替代源码定位；保留 SearchPage 的主题角色改动。

## 当前代码链与定位

1. `SearchPage` 的 `historyWidth`、`historyCollapsedCount` 初值都为0。`aboutToAppear → refreshVisibleResults → measureHistory` 在宽度未取得时直接返回；`initialContent` 只展示 `history.slice(0, historyCollapsedCount)`，故初始切片为空，同时原条件会把一条历史全部标成“1 条更多”。旧测量入口只在 `history.length > 0` 内的空 `Flex` 上；空历史首帧甚至没有测量入口，异步历史到达仍先以0宽运行。首次历史显示依赖一个本身受历史计数控制的空布局节点，存在启动依赖。
2. 现场JSON与此状态吻合：实际Scroll `[0,318][1280,2832]` 内Column却在 `[0,1357][1280,1794]`，只有“最近搜索/清空记录”和“1 条更多”，没有历史Text。SDK生产Builder探针直接复现零宽→零切片→错误更多标记，以及空历史首帧无测量回调。旧`Scroll`未设置对齐，短内容落在中心；该位置与JSON一致。
3. `SearchHistoryLayout.collapsedHistoryCount` 使用传入真实宽度按两行装入，并对长项钳制；现有纯函数检查与本次实际生产测量链都支持算法本身正确，**无需修改此函数或改成固定条数/字符计数**。
4. 本地探针不模拟ArkUI原生布局或原生事件派发；它证明上述生产启动依赖和实际SDK生成的属性/回调，而不声称捕获过旧Flex内部的原生回调时刻。修复可直接消除该依赖，不安排重复设备抓取代替定位。

## 最小修复

- 初始历史Scroll明确`Alignment.TopStart`，保留原搜索栏、28vp上间距、主题与历史chip样式。
- 唯一`onAreaChange`移到始终存在、与历史条数无关的外Column；从它的实际Area宽度扣原手机18vp×2/平板20vp×2内边距后测量。空历史时也能先持有真实可用宽度，随后历史Prop更新直接完成两行计数。
- 未收到可用宽度前不把所有历史显示成“更多”；宽度收缩至0时清除旧计数，恢复后重新测量。仍用平台`measureTextSize`的13fp/ReaderInter/500及px2vp，不引入字符宽度猜测。
- 保留原匹配的展开/收起动作与viewState；不改SearchGateway/Core历史事实，也不改刚补齐的应用主题颜色。

## 红绿回归与边界

- 新正式测试：`tools/test-search-history-layout-lifecycle.mjs`，复用已有真实SDK Builder探针和生产`measureHistory/refreshVisibleResults`。修前同一测试exit1（4 FAIL、1 PASS），修后exit0（5 PASS）；原文与结构化记录见`search-history-lifecycle-before.log`、`search-history-lifecycle-after.log`、`search-history-lifecycle-results.json`。修前源码副本仅供探针重现，见`search-history-before-source.ets.txt`，不进入生产。
- 覆盖：初始Scroll顶对齐；现场1280px宽度下一条历史出现；空首帧→异步历史；真实内容宽度两行/放大/缩窄/零宽恢复、长项和平板内边距；实际SDK展开/收起回调及持久viewState。平台字体测量回执由可控边界注入，实际字体像素仍是原生层。
- 关联4组通过：`test-surface-repair`、`test-search-view-state`、`test-search-publication-state`、`test-responsive-surface-widths`；原始回执见`search-history-related-checks.json`。未重跑Core全套、未构建或安装。
- `search-history-source-identity.json`记录修前/修后源码与测试hash，并逐行确认所有`readerAppColor`绑定保持一致；生产diff见`search-history-production.diff`。
- 代码与本地回归已完成；新增修复晚于第三包9509d4fe，不能归入第三包VM通过。后续同包最小验收：书架首次进入搜索不触键盘，历史从搜索栏下方显示，一条历史没有“更多”；多条宽度变化仍为两行且可展开/收起。无需新增用户设计决定。
