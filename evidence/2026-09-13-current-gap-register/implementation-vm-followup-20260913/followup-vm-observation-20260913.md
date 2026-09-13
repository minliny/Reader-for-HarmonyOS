# 第二包 VM 观察快照（2026-09-13 23:48 CST 冻结）

此文件整理本次已结束取证的证据，不建立另一份实时待办。当前任务状态只在根 [DEVELOPMENT_BACKLOG.md §11](../../../../DEVELOPMENT_BACKLOG.md) 维护；实施约束仍见 [READER_REPAIR_SPEC.md](../../../docs/READER_REPAIR_SPEC.md)。页面到达、静态截图、本地回归、完整动效及用户验收分别记账。

## 产物、目标与完整性

- 实际安装源码为 clean Harmony `a91af09f0ac97c767c9431641cda3efb6152bb70`，Core 是未改变的 clean `952704bd57518af530a948dfd3408a119c20e276`。截图名中的 `b17f29a4` 只是本轮命名前缀，不能作为已安装源码身份；相邻早期审计中的同名前缀也应按此校正。
- [manifest](../../../.reader-artifacts/hap/20260913T144756Z-a91af09f-e06b4393/manifest.json)：run `20260913T144756Z-a91af09f-e06b4393`，signed SHA256 `d842c697d9d8572b6332bbed89c9e7d98a23011190dd0d8f255d418aaeecf1e3`。222 组 Harmony 本地检查、隔离 ArkTS 14.367s、签名和独立 verify 通过。Core 沿用同源码首包 3726 项结果，没有重复运行。
- [部署回执](../../../.reader-artifacts/hap/20260913T144756Z-a91af09f-e06b4393/deploy-vm-6460677a198b-20260913T145051Z.json)：22:50:51 CST，既有 Mate 80 Pro VM `127.0.0.1:5555` / targetRef `6460677a198b`，`dataPolicy=preserve`、`install=PASS`、`launch=PASS`，签名身份前后一致。无卸载、清数据、重启 VM/SceneBoard/HDC。
- [操作与完整性日志](reader-control-probe-1789311106320-01fc958a-a378-43c2-8788-ced530e5a834.jsonl) 最终 441 条，SHA256 `197cdd68817d267c04496b9525d82eb917186da4454307d6882b312d192e3694`。逐一复核 118 份 capture 回执：73 JSON 可解析、45 PNG CRC/IEND 完整，文件长度与 SHA 全部匹配，无尾部额外数据。完整性通过只证明文件身份有效。
- 日志于 23:48:00.169 CST 写入 `closed / quit-or-eof`；root 的进程回执为正常退出 0 并释放 lease。最后布局为 `final-restored-back3`。这轮正常结束，与首包 PNG 尾部数据导致的 probe 退出分开记录；首包无效 PNG 仍不能用作验收。

## 首包四项补修的二包结果

以下文件均在本目录，前缀 `reader-control-b17f29a4-20260913-`；存在 PNG 的场景同时有对应 JSON。

| 补修 | 本次 VM 直接证据 | 结论及边界 |
|---|---|---|
| 空作者占位 | [initial.png](reader-control-b17f29a4-20260913-initial.png)、最终 `final-restored-back3.json` | 普通列表空作者保留第二行空白，最新章节及来源/进度留在第三/四行，与有作者书籍对齐；原四本书仍在。二包没有再抓批量模式，批量共享组件仍以真实 SDK 回归和首包观察为依据，不扩写为二包批量像素通过。 |
| Quick Auto 布局 | [auto-quick.png](reader-control-b17f29a4-20260913-auto-quick.png) | 播放控制区边框完整，当前值仅一份 8 秒，减/加号留在卡片内，无首包重叠/裁剪。Full 时长轮出现另一处宽度缺陷，单列如下。 |
| More 书籍信息 | [book-info.png](reader-control-b17f29a4-20260913-book-info.png)、[info-back.png](reader-control-b17f29a4-20260913-info-back.png) | 到达真实书籍详情，展示章节/简介/来源等内容，返回书架。保存失败、继续阅读、关闭失败弹窗、旧回调和取消后普通退出，仍是本地故障注入及 Index→ReaderShell→LRE 三层集成证据；本轮没有在 VM 人为注入保存失败。 |
| Quick Settings 圆角 | [settings-quick.png](reader-control-b17f29a4-20260913-settings-quick.png) | 有效二包截图显示三组条带外框圆角和选项圆角，文字显示完整；对应稳定态未再出现首包所定位的矩形裁剪覆盖。没有借此关闭全宽度/动效中间态矩阵。 |

`本地 local` 与 `本地 EPUB` 的文本沿用当前本地来源语义；没有新证据证明必须改为另一名称，没有新增样式决策。

## Full Auto 启动采样及控制操作

- 自动翻页完整入口的样本是 `reader-control-a2035ce4-4d26-46cd-a7a8-7beb962c60fd-frame-5.png` 至 `frame-9.png`。此前 `frame-0..4` 是前一次停在正文的采样，不能冒充 Full Auto 启动证据。
- 五份有效样本的截图命令实际触发偏移分别约 2.912、700.655、1402.030、2302.009、3500.178ms；这不是显示帧时间。`frame-5` 与先前稳定 `auto-full-149.png` 同 SHA，保留点击初段的完整控制页；`frame-7` 可见右下暂停钮；`frame-9` 可见自动翻页文字、倒计数和暂停钮，页码已左移。
- [frame-5](reader-control-a2035ce4-4d26-46cd-a7a8-7beb962c60fd-frame-5.png)、[frame-7](reader-control-a2035ce4-4d26-46cd-a7a8-7beb962c60fd-frame-7.png)、[frame-9](reader-control-a2035ce4-4d26-46cd-a7a8-7beb962c60fd-frame-9.png) 证明这些离散状态出现，不证明点击响应延迟、完整 3500ms 连续逐帧、四入口/中断、掉帧或输入至屏幕性能通过。
- `auto-full-paused`、`auto-stopped` 留下暂停和停止后的状态；点击 Full 标题“收起”未生效，`auto-collapsed` 仍是 Full。随后系统 Back 可退层，但不能用它覆盖收起按钮失败。

## 刘海、保锚与完整设置滚动

- `settings-full` → [cutout-reading.png](reader-control-b17f29a4-20260913-cutout-reading.png) → [cutout-controls-reopened.png](reader-control-b17f29a4-20260913-cutout-controls-reopened.png)：开启拓展后，隐藏控制时系统状态栏隐藏、自绘顶部信息上移；唤起控制后系统状态栏恢复。关闭开关后 [cutout-restored.png](reader-control-b17f29a4-20260913-cutout-restored.png) 恢复原安全区布局。
- 阅读当前槽是 `reader-page-slot-a`，opacity=1；相邻常驻槽 b 的 opacity=0。不能把 JSON 所含隐藏槽的 2/4、3/4 当作当前页。开启拓展后 a 的头部 17 行正文完全相同，只增一尾行，首字 y 从 300 到 252；footer 从 3/4 到 2/4 符合扩大视口后按同一锚所在新分页区间重新计数的代码语义。
- [cutout-anchor-footer-audit.md](cutout-anchor-footer-audit.md) 与 [逐槽观察](cutout-anchor-footer-observation.json) 已审计布局 key、保锚重排、Core ACK 提交、正文与 footer 同源。没有从此次差异定位到内容/页码不同步缺陷；VM 未导出完整新分页 scalar 边界，因此不声称逐页独立重算了真实全章边界。合成生产方法探针仅说明策略，不冒充 VM 边界。
- [settings-scrolled.png](reader-control-b17f29a4-20260913-settings-scrolled.png) 显示完整设置内容已实际滚动到导航状态栏、排版和控制等下方项目，顶部阅读控制条仍在上方；这只覆盖当前竖屏高度，不覆盖短屏、横屏、IME 或所有 Full 模块。

## 主题双向联动与最终恢复

1. `app-follow` 先确认应用“跟随”；阅读选择同为日间的暖白后，[warm-follow-check.png](reader-control-b17f29a4-20260913-warm-follow-check.png) 仍选“跟随”。同类型选择未取消 system。
2. 阅读选择夜间后，`theme-night` 的正文/表面进入夜间；[night-app-check.png](reader-control-b17f29a4-20260913-night-app-check.png) 应用明确选“深色”，符合不同类型才取消 system。Night 动态 SVG 漏变色是独立缺陷，见下一节。
3. 应用主动选择深色后，[night-default-appearance.png](reader-control-b17f29a4-20260913-night-default-appearance.png) 的阅读选中靛夜；应用主动选择浅色后，[day-default-appearance.png](reader-control-b17f29a4-20260913-day-default-appearance.png) 选中纸纹。默认日/夜仍显示“日间：纸纹 · 夜间：靛夜”，此次未改默认 ID，验证了应用到默认阅读主题的反向联动。
4. `day-app-restored.json` 恢复应用浅色；[reader-day-restored.png](reader-control-b17f29a4-20260913-reader-day-restored.png) 恢复阅读日间。最终 `final-restored-back3.json` 回到书架，原四本测试书/list 模式保留。默认 Paper/InkNight、宋体、cutout=false 保持；测试期间实际阅读进度正常前移，不声称回滚数据快照。

上述为指定路径的原生行为证据，不能概括成全部主题资源、系统换色事件、备份/冲突/重启及全页面日夜合成通过。

## 二包新发现、先代码定位的三项缺陷

三项都属于既定规格实现遗漏，不需要用户再定义样式或行为。以下补修在二包 a91af09f 之后，不归入该包的 222 组或 VM 通过证据；统一构建/签名/安装及新包 VM 仍待 root 执行。

| 现象及触发 | 已定位根因与修复 | 本地证据 / 下一包要回答的问题 |
|---|---|---|
| Full Auto 定时秒轮越出卡右边 33px | 卡片随窄视口缩为 281.714vp，但 picker 仍固定 176vp；以剩余宽度等分两轮，保留标签、左右边距与原字体，306vp 基准不变 | [timer 审计](../auto-full-timer-width-audit-20260913.md)：42 个真实 SDK 父子布局/日夜/往返组合和旧固定宽度变异验证通过；下一包确认稳定态分隔线全部在卡内、右边距 15vp、文字不重叠。 |
| Full 标题“收起”点击后保持 Full | Header 父层 HitTestMode.Block 截断子按钮命中；父层改 Default，叶按钮 Block 和原外观/事件保持 | [收起审计](vm-full-auto-collapse-observation.md)：真实 SDK 命中和完整收起链先失败后通过，7 模块×普通/减少动态、禁用/拖动保护及 5 项关联回归；下一包必须点击按钮复验，不能替换成系统 Back。 |
| Night 控制导航等动态图标仍用 Day 颜色 | 模板资源路径绕过旧生成器字面量发现，六处动态消费者未完整按 scheme 取资源；枚举现有有限资源，复用已定 Night 角色及 13 个派生 SVG | [动态 SVG 审计](../theme-dynamic-icon-audit-20260913.md)：101 个真实状态/颜色案例，六入口、保持挂载 Day→Night→Day、实际 SVG 非颜色字节、生成器与镜像漂移、受影响回归通过。576 双模式 App 角色、165 变体/350 资产是后续源码结果；下一包确认 Night 原生图标颜色及选中切换。 |


## 同轮代码复核额外定位的两个亮度异常

[readonly-spec-followup-audit.md](readonly-spec-followup-audit.md) 复核原21项、五模式及旧52ID时，以真实生产Writer探针定位：旧窗口/旧owner的lookup失败可误拒新pending；`getWindowProperties()`同步异常在任务try外，导致已出队任务悬空和未处理拒绝。前者补epoch/lookupOwner归属，后者将属性读取纳入任务try/catch/finally保证reject与清理。

正式writer回归[修前](brightness-boundary-before.log)失败、[修后](brightness-boundary-after.log)通过；[独立探针](brightness-failure-probe-after.json)修后2/2，3项亮度关联及13项TOC/五模式相关检查通过。没有新的VM/硬件发生次数证据；这两个是代码审计发现，不能与三项VM现场缺陷混计。修复在二包之后，统一门禁/ArkTS/签名和新包VM仍未完成，无新增产品待决。

## 仍开放的证据

这轮不关闭导入/搜索/在线 TOC 全旅程、远程书源名实际显示、书架恢复默认/同步/重启、全模块收起/短屏旋转、四入口连续动效与中断、旧性能和长时矩阵。真实触控至屏幕、GPU/120Hz/温升功耗、物理音频与亮度仍只能由符合前置条件的硬件取证回答；物理设备本轮未重新占用，用户验收 OPEN。

首包目录 [README](../implementation-vm-20260913/README.md) 中“四项等待新包 VM 复验”是首包结束时快照，不是现在的安装状态。根及 Harmony 顶层 README 未发现“安装进行中”文本；现阶段部署结论以本次回执和根 §11 为准，不把历史证据覆盖或删除。
