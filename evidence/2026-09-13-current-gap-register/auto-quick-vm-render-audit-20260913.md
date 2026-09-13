# Quick 自动翻页静止态布局失败与代码定位

## 现象与版本

- 已安装产物：`20260913T125821Z-2df5cfa6-7c0928b6`。由根任务负责 VM 取证，本子任务不操作设备。
- 失败原件：`implementation-vm-20260913/reader-control-auto-quick.png/.json` 与 `reader-control-auto-quick-settled.png/.json`。第二次在 32 秒后取得，布局 hash 不变，排除中间动效姿态。
- 现象：播放区右边框被截断；速度出现重叠的两份“8 秒”；`+` 越出速度卡片；看不到清晰的速度调整轨道。
- 本文件在修改生产代码前记录，原始截图与布局文件保留。

## 已确认根因

1. `sampleReaderControlAutoPage` 把 Quick 的内容宽度也写成 Full 的 `314 + widthDelta`。实测 viewport `[92,1681][1008,2346]`，density=3.5，对应约 261.714vp；播放区 `origBounds=[134,1821][1148,2186]`，被裁到右边 1008px，恰好溢出 140px=40vp。Quick 内容应为 264vp 基准，Full 为 314vp，不能只匹配子 actor 的位移而漏掉父框。
2. `speedRow` 同时常驻 Full 的标题旁数值、范围左数值与 Quick 的 `±`。原范围左值应为固定 `2 秒`（归档 Figma `1939:856`），代码却重复绑定当前值。标题区域右边119vp，范围区域从115vp开始，已有4vp几何重叠，尚未考虑文字实际宽度。
3. 固定子宽度不随当前 `frame().speed.width` 缩小；实测 `+` 的原始右边1025px，已超 viewport1008px。使用 Text 显示 `±` 时没有原设计的圆形表面与边框，还与范围标签重叠。
4. Slider 的 `opacity(0.001)` 是主动隐藏。需要区分设计：**Quick 原设计没有滑轨**，只有标题、减、当前值、加；Full 的语义 Range Slider 导出为空 frame，不能将它的空容器误当成“应隐藏整个交互”的要求。

## 直接参考

- 本轮 live 原始返回 `capsule-figma-live.json`，`/nodes/0/designContext/content/0/text`：Quick `I1308:3237;736:48` Speed264×30，标题 x6/w140/11sp；Minus x170/y3/24×24（表面+边框）；当前值中心x213/w30/11sp；Plus x232/y3/24×24。blur 副本使用同一几何。
- `evidence/2026-09-12-new-ui-audit/1939-848.yaml`：Full 标题+当前值、固定2秒、109×44范围框、固定20秒。
- `tools/fixtures/reader-control-restored-baseline-20260905.json`：共享速度父 actor32→64vp和264→306vp轨道继续保留；修复父布局和内部角色，不改已确认的动效时长。

## 修复与证据门禁

- Quick/Full 父内容宽度按各自端点插值，所有显示边界不越过 viewport。
- 速度标题和当前值各为一个保留 actor；Quick `±` 单独显隐，Full min/range/max 单独显隐；Quick 不再渲染 Full 的范围文字。响应宽度以实际速度父框预算，双位数当前值也不截断。
- 保留同一个生产 Builder 的正向、反向及纯 source 副本；本地回归执行实际 SDK 生成的 Builder 闭包，量化其已发出的绝对尺寸及可见区间，不能把字符串匹配当原生布局验收。
- 必须先证明旧生产代码触发父框越界、重复值/重叠的失败，再证明修复后的已发出几何通过。VM 的像素与原生布局最终证据仍由根任务使用新 manifest 取得。

## 已落地修复与回归

- `ReaderControlPlaybackGeometry.ts`：内容父宽改为264→314vp；新增速度内部7个明确角色（title/current/minus/plus/minimum/slider/maximum），每个使用父框的实际宽度。Quick 保留30vp当前值槽位，Full25vp，避免20秒等双位数截断。Full 的字号和既有父级时序不变。
- `ReaderControlAutoPageContent.ets`：当前值只渲染一份；Quick 采用带边框和表面的24vp加减按钮；Full 固定2/20范围标签与平台滑条；所有绘制色通过应用主题角色。内层绝对定位在(0,0)，避免 ArkUI 未定位的 Stack 自动避让1vp边框后产生额外偏移。纯 source 投影不会发布重复 actor ID。
- 百分比排查：当前 AutoPage Builder 本身没有百分比宽度；实际失败由父宽和固定子坐标越界引起。没有把未证实的百分比引擎问题作为根因。
- 失败证据 `auto-quick-builder-before.json` 来自修改前真实 SDK 生成的 Builder 闭包。新门禁先报 `Quick playback card exceeds viewport: 301.714285714 > 261.714285714`，与 VM 的140px裁切一致。
- 通过证据 `auto-quick-builder-after.json`：同一探针执行84组宽度×秒数×正反向进度样本；父框、文字和Full滑轨不越界；Quick只有一份当前值；点击加减与Full滑条绑定真实业务回调；Night所有绘制色有效；纯source无重复ID。探针不模拟原生字形栅格化，保留VM确认门禁。
- 小型原生布局回归夹具：`tools/fixtures/reader-auto-quick-native-layout-20260913.json` 保留原文件路径、SHA256与有关节点原始bounds，测试不依赖整张设备快照文件。
- 已通过：`test-reader-auto-page-native-layout`、`test-reader-control-playback-content`、`test-reader-auto-page-full`、`test-reader-control-playback-host-intents`、`test-reader-session-launch-recovery`、`test-reader-control-morph-scroll`、`test-reader-session-launch`（48 actor / 54000属性比较）、`test-reader-render-work`。

状态：代码定位完成、修复完成、本地回归通过；新产物/VM 原生布局与像素复测由根任务继续。未将 SDK Builder 属性检查声称为 VM 视觉通过。
