# 漫画弹窗动效与字体修复记录

用户在 2026-10-03 指出目录内部样式仍错误，弹出动效与自生成 demo 不一致。旧包的三张静态截图、SDK 样式探针不能证明动效一致，不能继续将其记为通过。

## 已确定的代码原因

- demo `evidence/2026-10-02-manga-ui-demo/src/mobile/BottomSheet.tsx` 明确规定两层独立动效、不同进入和退出弹簧、退出保留节点及拉手操作；旧 `MangaReadingSurface` 直接设置／清空 `panel`，不存在动画或退出生命周期。
- 目录及面板 Text 以前没有指定与 demo 对应的字体；变量字体只有数值 weight、没有变量 weight flag 会使用错误的轴值。TextInput 的 SDK 接口不支持该 flag，需要同源静态 Regular 字体及 checked load receipt。
- 原 `openRevision` 借用了定位按钮的 `directoryRevision`，一次定位会同时重置目录身份；现分离真正打开目录与显式定位的 revision。

## 已落入源码的行为

| 动作 | 原生实现 |
|---|---|
| 打开 | 先清焦点／收键盘；保存仍归现有 progress owner，保存与视觉进入并行；目录、阅读方式、设置及更多统一等待四个静态字体 receipt |
| 首帧 | 挂载 `panel`，offset 为 snap 最大高度 + 36，遮罩为 0；第一个原生 frame 只登记第二个 frame，第二个 frame 才请求动画 |
| 进入 | 遮罩 160 ms EaseInOut；sheet 使用 SDK `interpolatingSpring(0,.9,500,43)` 到 offset 0 |
| 退出 | 内容身份、标题及行保留；遮罩 160 ms EaseInOut；sheet 使用 `interpolatingSpring(0,1.05,250,30)` 到屏外；onFinish 才撤销内容 |
| 拖动 | 手机拉手只接受向下；跟随及短拖回弹使用进入弹簧；严格大于 96 vp 或向下 550 vp/s 关闭 |
| 减少动效 | ReaderShell 已有 reduceMotion 传递给漫画 surface；原生动画与 frame 请求省略，生命周期仍采用同一终态及导航边界 |
| 异步边界 | generation 拒绝旧 frame、退出回调、迟到的保存／导航；卸载取消 promise、字体和动作 owner；关闭期间内容和异步目录目标拒绝交互 |
| 字体 | panel Text 分别指定静态 400/600/900 face；目录当前项指定烘焙 550 face，普通及辅助信息 400、分组 600；不请求 variable flag；TextInput 使用静态 400；常驻目录在 receipt 前保留空内容，图片读取不等待面板字体 |

`MangaSheetFrame` 为面板专有 frame callback，不占用或改写 MR19 的 `MangaLayoutFrame`、分块、图像尺寸、位置保存和资源 owner。

手机距离、两组物理参数来自 demo。demo 只为 phone 挂载 BottomSheet；宽屏采用对应的右侧布局并从右侧进入，仍不能据此记为已通过 demo 的宽屏动效验收。宽屏透明外部点击关闭区域为明确的原生交互适配，demo 没有整页遮罩。

## 代码／SDK 证据

`node tools/test-manga-sheet-motion-sdk.mjs` 执行实际 SDK 降低后的生产方法、状态和 Builder actors。其 native 边界只记录帧、输入／字体 I/O、原生动画请求和完成回调，不模拟 compositor 或自造弹簧算法。

覆盖首帧 callback-before-build 顺序、两组弹簧、遮罩、退出内容保持／交互阻断、四类弹窗与常驻目录字体准入、精确静态 Text face、拖动阈值／回弹、reduceMotion、迟到的 target／save／reopen／卸载。相同断言拒绝即时销毁、缺 generation、错误弹簧、单 frame、缺卸载 guard、缺字体准入及迟到字体 receipt 的窄负控。旧 VF 版本的探针结果保留为历史证据，R2 VM 字形失败已撤回其视觉结论。

日志：`evidence/2026-10-03-manga-reader-sheets/sdk-motion-r2-green.log`。旧 surface、assembly、selection、navigation、ui-state、error-recovery、session、motion-progress 的对应回归均通过。旧业务方法 probes 保留真正的新 helper 及默认状态；只在不测动画的业务场景显式使用 reduceMotion。

## 尚未验收的边界

本记录不代表新的 signed HAP、安装、物理字体绘制或 VM 动效通过。VM 空闲并由主任务重新绑定当前源码／产物／目标后，必须使用连续录像或按时间采样帧对照 demo 的进入及退出；核对首帧、sheet／scrim 时序、弹簧终止条件、连续操作、短拖与甩动、键盘及字体。原生引擎与 Motion 库的速度继承／终止阈值可能不同，静态截图不能关闭这些项目。

## 规范 gate 中发现的旧接线断言问题

2026-10-03 主任务的全量规范 HAP gate 在 `tools/test-reader-control-p0.mjs:233` 停止：ReaderShell 中 `reduceMotion: this.reduceMotion` 匹配数实际为 4，旧断言要求固定为 3。新增 `MangaReadingSurface` 减少动效传递为本次真实接线；既有 `ReadingExperience`（由 `LocalReadingExperience.ets` 导出）、`ReaderFullDirectory`、`SourceSwitchPanel` 三个入口仍存在。根因是全文件出现次数断言把合法新增接线当回归，也不能区分删掉某个旧入口后在另处补一个同名属性。

本问题先记录后修测试：仅接管该 P0 测试，以安装 SDK 的 ETS AST 分别验证上述四个具体组件调用的 `reduceMotion` 参数直接来自 `this.reduceMotion`，并用“将单个入口参数改 false、另加相同属性作数量补偿”的窄负控，确保全局相同数量无法掩盖错误。产品源码、构建和 VM 不在本子任务范围；主任务保留本次原始 build 失败日志并继续唯一规范 pipeline。

复核：`node tools/test-reader-control-p0.mjs` 退出 0，四个入口正控及四个逐入口数量补偿负控通过；`node --experimental-strip-types tools/test-manga-sheet-motion-sdk.mjs` 退出 0，既有实际 SDK-lowered 生命周期/减少动效/字幕字体/退出/异步负控仍通过。`git diff --check` 通过。P0 测试冻结于 2026-10-03 18:10:27，SHA-256 `4c3f75e4f96ce2bc8fb5d7b4239299c1889e7eefd87bb3919353e91796aa0990`。这只是测试 gate 修正及本地复核结果，不表示规范 HAP pipeline 后续层已通过。

## R2 VM 实际字体失败与后续修复范围

主任务已安装 R2 HAP。原图 `evidence/2026-10-03-manga-reader-sheets-r2/vm/dir-open/frame-5.jpeg` 中目录行及操作文字仍极细；因此上文 VF family/variable flag 的 SDK 属性请求通过，不能记为实际字体绘制通过。本次失效涉及 VF 在目标端的实际 axis/paint 边界，已由主任务记录并释放 VM；本子任务不重新占用设备。

固定字体修复由 ReaderFonts owner 提供精确静态 400/550/600/900 face 及四个 checked receipt；Surface 的目录、阅读方式、设置、更多统一等待四个 receipt 才挂载及请求两阶段进入，图片加载不等待面板字体。所有 panel Text 与 fallback 行已切换为对应的静态 family，移除 variable flag。常驻宽屏目录也经过同一字体准入，不提前画 fallback 字体。已有弹簧、退出保留及 generation/save/unmount/reopen 边界保持。

R2 原样本仅证明目录进入有中间位置：frame-4 相比 frame-5，拉手、标题、输入及行整体低 34 个原图像素；frame-0..3 为相同基线、5..21 为相同終态。遮罩在 frame-4 已等于最终透明度，未捕获 fade 中间态。`/proc/uptime` 被拒绝造成时间字段为空，不计算时长，不据此关闭曲线或完整动效验收。

## 本轮静态字体与三种目录布局收口

手机目录保留搜索、定位、排序工具及 330vp 上限；宽屏右栏仅保留目录，按完整 stage 而不是扣除左栏后的画布计算宽度。普通宽屏上限 340，横屏上限 320；stage≤700 使用 min(320,85%) 及 16vp 内缩，其他宽屏内缩20。右栏标题15/24静态600，header66+间隔17，分隔线位于内缩容器内；短横屏 minHeight0，避免 min260/max230 冲突。当前项初次定位相对列表7vp，连同 header 总90vp；手机／左catalog初次50，显式定位12保持。

常驻左catalog使用258／窄168宽度，80高 header 显示真实书名（现有 Serif Bold18/26，窄16）及10/17副标题。它没有搜索／工具，也不继承弹窗查询；行48，分组44，窄字号与子项内缩按 demo。打开右栏目录是真实入口，不再在 persistent 分支提前 close/return；稳定 open 的任何右面板仍允许左catalog选择章节，准备／进入／拖动／关闭阶段拒绝其重复操作。catalog回调显式携带fromCatalog，右目录仍仅directory/open准入，双方复用关闭→保存→切换及既有generation边界，位置保存仍归现有 owner。

Fallback复用既有共享 List、投影及业务身份校验，目录事实未知时不造分组；手机58／宽屏50／catalog48行与44组由同一保留 actor 属性更新。搜索目标平铺left10；当前项字体在400↔烘焙550切换，普通native weight400；全目录count/parent与canonical index不因过滤或折叠改变。顶线跟实际首个投影行滚动，空结果也保留该线；catalog无顶线且尾部18vp，其余14vp。

设置保留旧 white 底色（两个新选项均不伪造选中）以及小于20%的真实亮度；Slider只夹显示位置，百分比显示真实旧值，用户操作才写新值。恢复默认改为78手动亮度、竖向、适合屏幕、页码开，保留当前底色。原生Toggle仍负责绘制与非触摸状态回调；46高整行是触摸唯一动作。安装SDK `ets/component/enums.d.ts:8247-8269` 明确 HitTestMode.Block 阻断子节点命中，Row用它排除子Toggle触摸，避免两个owner同时切换；SDK `toggle.d.ts:161-201` 的SwitchStyle提供pointRadius8.5、pointColor、unselectedColor与trackBorderRadius11.5。实际命中与thumb中心位置仍需VM核验。底部进度及亮度 Slider 同用 day#1F3528/night#ABC39E 的 range accent。

900子集只给四个固定标题（章节目录／阅读方式／漫画阅读设置／更多），不用于动态书名或正文；SDK遍历四种弹窗所有Text及900actor限制。receipt失败／迟到不得挂载或改写图片owner，常驻目录也由checked flag控制真实内容分支。

新增探针首次执行也出现失败，均保留定位：更多fixture缺title、persistent旧断言仍期待手机TextInput、目录target断言遗漏真实accessibility层级前缀，以及负控错误信息匹配不完整。已补齐fixture及真实方法依赖、沿用生产accessibility helper并修断言信息，未通过改写生产方法替代问题。最终正控和同路径窄负控一并重跑；结果与源码SHA将在下一节冻结记录。

## 冻结与本地最终结果

2026-10-03 10:58:05 UTC（北京时间18:58:05）冻结产品源码与相关探针。最终9项执行均退出0：sheet-motion-sdk、sheet-selection-sdk、surface-sdk、reading-directory-fallback、ui-assembly-sdk、motion-progress、session、error-recovery，以及reader-control-p0。`git diff --check`退出0。完整合并原始输出、命令和14个源码／测试／helper SHA绑定记录在 `evidence/2026-10-03-manga-reader-sheets-r3/sdk-sheet-static-final.log`，未调用HAP、VM或提交。

- MangaReadingSurface.ets：`e1a1fc0eb140881b4346303c129b0a638b8e6682adc8ac185ac562b5afd9b874`
- MangaReadingDirectoryFallback.ets：`67980a6895eaf34454fcac84fab7e889558c81b5c4d6ed2fa7b1ecb1ff7ed929`
- sheet-motion-sdk：`898d27ea8260860194ed697dc9ab13ebc892f32bb3bce5f0c4260d4aeb06d64d`
- sheet-selection-sdk：`581d6d7b8ca565b6c80d1a7e1458694b54bcbbd3571798ab41a342bb6e4a63bf`
- surface-sdk：`a6c031943dc0fd9c31f940273f23301fee73c17ed933bacc23bde366f5d1839f`
- fallback SDK：`726c8ef27a7c8161abc1d32cc78b545997a5bbc4f32ff8a2f81c1dc6d20a9161`

新增负控覆盖真入口提前return、catalog回调遗漏origin、split canvas误作stage、去掉persistent宽屏判断、左catalog继承查询、静态face恒为550、catalog失去Prop调度、搜索沿层级缩进、虚假white选中、低亮度虚假百分比，以及Row/Toggle双触摸owner。原有生命周期／receipt／迟到保存及重开／卸载负控仍执行。

剩余OPEN仅归正确验证层：当前静态face的目标字形绘制、真实连续进入／退出和scrim曲线／时间、原生Toggle中心位置及label/switch位置各一次点击、原生宽屏布局与目录滚动位置。SDK输出不含renderer/compositor，不能据其关闭上述项目；新signed HAP、签名、安装和VM绑定由主任务唯一规范pipeline另行完成。
