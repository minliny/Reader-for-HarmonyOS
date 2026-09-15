# PH101 快捷朗读无法启动与动效恢复

基线：Harmony `ad09531c` / Core `bf4949531`。手机最后安装 `20260915T151630Z-356f150e-e58cc5c3`，VM 最后安装 `20260915T162937Z-29fdf744-5f6a636a`。两版本均包含以下输入校验缺陷；本次不操作手机。

## 确定原因与实施

`LocalReadingExperience.ttsChapterRef` 总是构造 `bodyVersion`/`processingVersion` 两个本地位置归属字段，即使本地书的值为 undefined，键依然存在。`ReaderTtsGateway.slice` 原先直接用严格五字段 Core 章引用解码器校验，因多余字段立即抛出 `tts.slice chapter returned unexpected field bodyVersion`。本地生产方法回归修前 Host speak 次数为 0，尚未到 Core RPC 或语音引擎。

点击时胶囊动效已经同步启动；上述异常进入 `cancelSessionLaunch('failure')`，恢复快捷播放器。它确定解释启动失败及控件恢复，尚不能把具体左移幅度称为已由设备帧证明。

修复采用输入上下文与 Core 协议投影分离：网关检查五个协议字段及两个可选本地版本字段，向 Core 仅提交协议五字段。slice、所有队列操作、回调和跨章计划统一应用该投影。Coordinator 保留原始版本引用；完成回调、正文替换和晚到事件继续执行版本隔离。Core 回包仍严格解码，不扩展协议，不删除正文版本保护。

复用现有 SDK/Coordinator 的协议适配，不新增通用算法或依赖。未调整原有控件尺寸、间距、动效时间和布局。

## 本地证据

- `reader-ph101-tts-gateway-before.log`：新增生产链回归在修复前失败，明确额外 bodyVersion 被拒绝、speak=0。
- `reader-ph101-root-tts-test.log`：实际阅读页章引用、Coordinator、Gateway 的组合回归通过；本地/在线版本、全部外发端点、引擎启动回执、进度版本保留、同章正文替换、旧 slice 晚到隔离及严格非法字段拒绝。
- TTS session coordinator/state machine/launch intent/quick preparation 定向回归通过，各原始日志同目录。
- `reader-ph101-tts-layout-probe.log` 与脚本：SDK Builder 覆盖 ready/preparing/playing/paused/resuming/stopping/error/failed 状态，快捷播放标签及四按钮 x/y/宽/高一致。它排除了这些状态单独引起静态布局变宽，不证明 Native 合成帧。
- `reader-ph101-root-launch-recovery.log`：现有失败恢复回归通过；归档 Figma 轨迹采样通过仅为代码轨迹层，不能替代设备流畅度。

## 最小 VM 验证范围

本地无法证明实际 ArkUI 图层交接、系统 TTS 引擎回调与用户所述瞬间偏移。新包完成后，只在已存在并确认就绪的 Mate 80 Pro VM 上，保留数据打开已有书籍，快捷朗读点击播放、获取短时画面/布局及状态，确认是否启动、是否发生恢复，再停止朗读。发现新故障先回到代码定位。手机听感和用户验收仍独立 OPEN。

## 产物与 VM 结果（2026-09-16 北京时间）

修复提交 `ce5026cc`；构建源码 Harmony `973aa937` / Core `bf49495317798f68b98928712eb6e106af02bed1`，两仓构建时 clean。run `20260915T170116Z-973aa937-8ca702f9`，276 组 Harmony、ArkTS 编译、隔离非增量构建、signed debug 签名验证和独立 manifest 复验 PASS。Core Native 未改动。

- [不可变 manifest](../../../.reader-artifacts/hap/20260915T170116Z-973aa937-8ca702f9/manifest.json)
- 签名 HAP SHA-256：`6f05565d0f4d1ad2f7d8e3e9ba70a5b602e67ee0c5a302acf37dcb2d2e034b9a`。
- 既有 ArkWebResourceDiagnostic 类型名称与 SearchPage ObjectLink 编译警告保留在原日志；编译退出成功，不称无警告。
- 当前现场重确认 Mate 80 Pro / 原实例路径，Emulator PID 21552（9/13 启动）、HDC `127.0.0.1:5555` Connected、boot.completed=true、Emulator 完成标记、SceneBoard PID1529 自02:19:23连续运行。没有冷启动/新建/重置 VM。
- 2026-09-15 17:02:44 UTC 保数据覆盖安装并普通启动 PASS，targetRef `6460677a198b`。[部署回执](vm-deployment.json)

在已有本地测试书 `ReaderPagingAudit20260911` 第18章，从快捷朗读控制点击播放（17:05:39 UTC）。采样显示控件进入既定向右下角的胶囊过渡，最终胶囊显示暂停按钮，没有退回原快捷控件。17:06:13 再唤起控制栏显示“朗读中”；源码只在实际引擎 onStart 后发布该状态，前后截图的正文朗读下划线从首行推进到后续段落。17:06:48 点击停止，随后恢复“未开始”；17:06:49 退出探针并释放锁。

[播放前](vm-repaired/reader-control-ph101-before-play.png) · [播放后胶囊](vm-repaired/reader-control-26958064-dfdd-41dc-a5ce-5e74f024a9bb-frame-4.png) · [持续朗读](vm-repaired/reader-control-ph101-live-tts.png)

新包的系统 TTS 启动、推进、停止 VM 路径 PASS；采样未复现“左漂再恢复”。点击前、朗读中、停止后播放器布局边界均为 `[131,1727][970,1958]`。采样为5张离散截图，实际触发约3.5/326.7/1012.9/2010.5/2400.8ms，并非连续录像或帧率测量，不能宣称完全排除采样间瞬态偏移。未录制/主观验收输出音频，不扩大为所有语音服务通过。期间只操作已有 VM，手机仍为旧包，手机动效/音频和用户验收 OPEN。
