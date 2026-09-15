# PH98 补充：关闭拓展到状态栏后的偏色

## 触发与证据身份

2026-09-15 用户补充：关闭“拓展到状态栏”后，状态栏颜色再次错误。当前源码基线 Harmony `9388a8ae`，Core `c86b6aaec60b5c60a3a73254aac03ce6ddce4de9`。用户未指定具体主题、背景/文字图标以及现场包；上一轮 PH98 新包未安装，不能把本次称为该新包回归失败。沿用 PH98，不新增产品待决事项。无真机或 VM 操作。

## 已定位的代码缺口

1. `LocalReadingExperience.readerStatusBarUnderlay` 的尺寸和位置直接读取静态 metrics，SDK 生成的 Row 观察闭包没有读取 `readerWindowMetricsRevision`。以零区域挂载后，仅通知测量变化，底色带仍为零；已有非零区域的位置、宽高也可保留旧值。真实 SDK 闭包依赖探针 [underlay-before.log](underlay-before.log) 两项 FAIL、八主题原色 PASS。逐次全量重执行 Builder 的旧测试会掩盖这一缺口。
2. `ReaderWindowCoordinator` 在显示 API 回执后将 hiddenApplied 设为 false，并立即刷新测量。API 回执并不保证系统实际区域已经更新；此时返回零区域会将原先保留的状态栏区域清空。真实 LRE 设置提交与完整 Coordinator 回归 [toggle-before.log](toggle-before.log) 显示高度由48变0，导致预期保留失败。窗口端口仅控制公开异步回执/区域事件顺序，没有模拟“系统显隐必定重置颜色”。上游接口边界见 [既有审计](../UPSTREAM_AUDIT.md)。

这两项证明当前 Reader 的测量与绘制缺口，不证明它们是用户此次实际偏色的唯一原因。已排除的源码分支：开关不改变 Index/ReaderShell 根原点或父 padding；底色层 zIndex10 高于控制栏；八主题底色始终来自阅读主题，未发现开关处应用主题替代阅读主题的直接分支。

## 实施

- Row 的每项几何属性通过读取观测 revision 的 helper 获取当前测量，订阅真实局部更新；不会靠重挂载、切换主题或固定机型高度刷新。
- 协调器记录隐藏后的显示过渡。在显示回执与真实非零区域到达之前，保留同一窗口几何/显示/旋转对应的已测区域。回执前的非零事件不能提前结束保留；重复显示请求保持 pending。确认回执后非零区域到达即结束保留，后续真实零区域仍可清除。
- 隐藏/窗口释放重置过渡；新窗口、分屏或旋转没有匹配测量时不借用旧高度。显隐回执增加安装代次校验，防止同一 Window 对象重新安装后接收旧状态。
- 不修改阅读主题原色、纹理、控制栏应用主题归属及单开关产品规则。

## 本地回归

[toggle-after.log](toggle-after.log)：10组生产方法场景通过，包括八主题×控制栏已展开/未展开的真实 true→false 设置提交、关闭控制栏仍显示状态栏、回执后零区域、后续实际矩形更新、前景/底色保持阅读主题；另覆盖回执前非零事件、重复显示、应用所有权、快速显隐反转、窗口替换、同尺寸旋转。设置持久化端口和页面重排后的颜色申请为受控边界，不把该探针当实际存储或正文排版验收。

[underlay-after.log](underlay-after.log)：SDK Row 测量订阅、零区域恢复、位置/宽高更新、八主题原色通过。此处仅重放实际订阅变化属性的 SDK 观察闭包，不重执行整个 Builder；不等同于 Ace 原生排版或像素验收。

[measurement-after.log](measurement-after.log)、[dedup-after.log](dedup-after.log)、[settings-after.log](settings-after.log)：原有精确窗口缓存边界、相同策略去重及单开关设置回归通过。旧 PH98 的颜色写入失败/窗口替换修复仍由同一测试保留覆盖。

## 未验证层

本地代码与专项回归完成。构建/签名结果待绑定本次最终 manifest；VM、真机像素、用户验收 OPEN。本轮不占用设备。具体用户主题和背景/前景表现仍未绑定现场证据，不因此新增用户产品决策，也不要求用户重新定义颜色。

## 最终产物

正式 pipeline run `20260915T145417Z-86558615-52617e09` 已通过275组Harmony检查、ArkTS类型检查、非增量编译、签名及独立manifest复验。构建时 Harmony `8655861547bbdcbf1973de9094af4a10a60d84d4` / Core `c86b6aaec60b5c60a3a73254aac03ce6ddce4de9`，两仓 clean。

签名 HAP `entry-default-signed.hap`，168157840 bytes，SHA-256 `c4081d8c8b014f9360bb3c1a2fcc45b9538c8985a5a7ac15325011a42e8ec937`；signed/debug Profile、验签PASS。唯一可交付 [manifest](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/.reader-artifacts/hap/20260915T145417Z-86558615-52617e09/manifest.json)；[归档副本](manifest.json)、[构建日志](build.log)、[独立复验](verify.log)。

产物为 iteration，acceptanceEligible=false。本轮没有安装、启动或操作VM/真机；应用数据未触碰。VM与真机像素、用户验收OPEN。此产物包含本次底色测量补修及之前PH94–98代码，不将先前未安装包当真机已用版本。
