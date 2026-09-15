# PH94–PH97 修复交付记录

本轮四项反馈中的确定代码缺陷已修复；本地回归及签名 HAP 构建、校验完成。本轮没有安装、启动、测试或抓取真机/VM，设备表现和用户验收保持 OPEN。

## 四项实际修改

| 反馈 | 确定原因与修改 | 验证边界 |
|---|---|---|
| PH94 点书等待 | Core 缓存读重复读取全书位置记录并处理正文；改轻量验证并复用投影。Host 带 Core 权威进度校验首章，仅当双版本、全部锚点与会话一致时交接复用；目录附加状态延至首屏提交后。 | 实际 Index→LRE→网关探针：同位置 2 次权威进度、1 次正文；位置变化仍重新读取。合成 5 次缓存读取约 239ms→17ms，不是手机总时延。 |
| PH95 刷新失败 | 修复强刷被自身两次版本更新取消、刷新与进度落盘竞争、正文已换但显示重试仍带旧版本。增加与正文原子提交的逻辑章地址和响应地址绑定，支持有证据的同章重定向。 | 生产协调/显示恢复方法回归及真实 Core HTTP→SQLite→Host 解码/带版本进度提交通过。自动显示恢复最多一次。原手机弹窗内部错误未取得，不能认定某一项就是原现场唯一原因。 |
| PH96 返回详情闪烁 | 当前 Core 证据已确认可读时，旧逻辑仍撤销按钮可用状态并启动竞争探针。现区分可读证据与旧正文缓存，合并必要重验证；过期目录自动按原身份重新准入，保持书架归属及返回路径。 | 实际 Coordinator、Gateway、Index 方法验证延迟正文、重复通知、换目录、来源/版本失配及失败终态；不以旧正文冒充新版本。 |
| PH97 模式切换图标闪烁 | 原动画在 270–500ms 将含四个按钮的整行设透明。现仅标题沿原透明度动画变化，按钮持续显示。 | 52 个日夜/双向采样及 SDK Builder 控件身份通过；保留图案、尺寸和列表/封面动画。不是设备像素验收。 |

## 源码与验证

- Core 生产修复 `5c79799d5`，补齐测试/Clippy 后最终 `c86b6aaec60b5c60a3a73254aac03ce6ddce4de9`，构建时 clean。
- Harmony 图标修复 `cb87ae55`、阅读流程修复 `c137b4b3`、Native 更新 `9cf75f78`；最终构建源码 `1b2e613629e7e7e1071d0922955d63cc87dca036`，构建时 clean。之后提交仅归档本记录与证据。
- Core 全量退出 0：3890/3890 断言、210/210 协议、fmt/clippy、strict drift、C/C++ ABI 通过。保留 1 个既有同名 CLI host_replay LEAK 警告；不称无警告或已证明无资源泄漏。
- 最终 Harmony 273 组检查、ArkTS 编译、非增量 HAP 构建及签名/文件哈希校验通过。保留编译警告；首次整合探针依赖缺失、首次 ArkTS 闭包类型收窄失败日志均归档，不能算成功尝试。
- Native buildId `af012d049cee4cd69df12bb2a1ef432677d75b533fa64dd731d2522821ae7b7e`；构建输入 NAPI SHA-256 `a025a209a189b44d150563a16d0e0b653f635eee2868ac279e77ea0fc0c80bd5`。

## 产物

- run：`20260915T132601Z-1b2e6136-a0d4b317`，iteration，`acceptanceEligible=false`。
- [原始不可变 manifest](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/.reader-artifacts/hap/20260915T132601Z-1b2e6136-a0d4b317/manifest.json)
- [签名 HAP](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/.reader-artifacts/hap/20260915T132601Z-1b2e6136-a0d4b317/entry-default-signed.hap)
- signed HAP：168159274 bytes，SHA-256 `ef1d05a343bac16fcefc88ff39f5916f4331f238badd2d24c5a16ff5d07f4925`。
- [最终构建](reader-ph94-97-hap-final.log)、[独立校验](reader-ph94-97-hap-verify.log)、[证据文件校验索引](evidence-files.json)。`final-manifest.json` 为元数据副本；重新校验产物使用上方原始 manifest 及其完整产物目录。

## 保留边界

缺少历史 URL 绑定、原请求和本次响应地址又都不匹配旧缓存的情况，仍明确拒绝猜测覆盖并保留原数据。不能通过删除 query 或信任当前目录反推历史身份。手机原刷新失败的具体内部错误、真实点书耗时、返回/切换的屏幕表现仍待用户或后续合规设备证据确认；未清除任何设备数据，也没有把本次产物发布当成用户验收。
