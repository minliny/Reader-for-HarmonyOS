# 受限触摸诊断 probe 接口

2026-09-06：仅开发诊断工具，不进入产品 HAP。不发现设备、不启动服务、不安装/卸载；本轮仅离线实现/测试，未 push 或执行设备。

更新：主代理随后执行的独立 ELF dry-run 在 main 前因 Ark runtime 依赖加载失败，未请求授权或注入；该路线已停止，不改库路径/namespace，不继续 prepare/dryRun/sampleTouch。详见 `evidence/control-bar-development-20260905/NATIVE_TOUCH_LOADER_AND_UINPUT_DIAGNOSIS_20260906.md`。下面 ELF 接口作为实现记录保留，不是继续执行许可。

启动沿用 `tools/reader-control-device-probe.mjs` 的四个显式参数与目标锁。每个非 quit 操作均要求新的 `preflightConfirmed:true`，表示操作者已在外部核实 AGENTS 的就绪/SceneBoard/精确目标/前台应用/安全坐标；该字段本身不生成就绪证据。每次读取保留原始回执，失败即停、无自动重试。

新增 `{"op":"motionLog","preflightConfirmed":true}` 仅调用固定 `hilog -x -e ReaderControlMotionProbe`。

## 当前获准准备的系统工具接口（待目标验证）

```json
{"op":"sampledClick","x":100,"y":200,"sampleDelaysMs":[0,60,150,300,700],"preflightConfirmed":true}
{"op":"heldTouch","x":100,"y":200,"durationMs":1500,"sampleDelaysMs":[0,400,1200,1800],"preflightConfirmed":true}
{"op":"heldTouch","x":100,"y":200,"durationMs":500,"preflightConfirmed":true}
```

示例坐标不是目标已确认把手位置。`sampledClick` 固定执行既有 `uitest uiInput click x y`，用于点击后自动展开/收起采样。`heldTouch` 固定执行单进程 `uinput -T -d x y -i durationMs -u x y`；按下/抬起必须同坐标，durationMs 仅整数 1–3000，禁止用户附加 argv/改终点/指定指针/CANCEL。省略 sampleDelaysMs 时只执行闭环命令；提供时复用现有 sampledDrag 的同一受锁采样器，不引入第二采样时钟。

两种采样的延迟都是整数 0–10000ms、严格递增、最多 5 帧。与 sampledDrag 一致，其时间原点是 **HDC 命令启动**，不是已确认 native DOWN/点击分发时间；各 frame 记录实际 screenCap 触发偏移。截图及回读可能晚于请求值，不能称精确帧。执行及采样继续使用已有目标锁、外部 preflight 确认和 commandOK 停止规则，任何加载错误即使 HDC 返回 0 也会停止。没有放开任意 shell、系统库改动或注入权限绕过。

官方依据：[uinput 触摸事件文档](https://github.com/openharmony/docs/blob/master/zh-cn/application-dev/dfx/uinput.md#L497) 明确 d/u 可顺序闭环；[输入命令源码](https://github.com/openharmony/multimodalinput_input/blob/master/tools/inject_event/src/input_manager_command.cpp#L1396) 的 d/u 固定 pointerId0，i 仅 sleep（当前读取 blob `b443699dcb4d48c0e020e96ff9a96b41b1b9be5e`，i 在 L1527–1542）。官方 master 不等于当前目标 binary；本次工具扩展尚未在设备执行。**不覆盖反向持指 MOVE、CANCEL、多指或原生视觉验收。**

红→绿：先增加真实 operationPlan 白名单断言，旧实现以 `operation is not on the diagnostic whitelist` 失败；接线后通过，连同 duration/额外字段/坐标/延迟/缺 preflight 的拒绝用例。独立测试还执行实际共享采样 closure，核两个新 op 的 exact argv、两帧 screenCap/recv，以及 HDC0 loader 错误立即停止而不采帧；仅模拟传输，无 HDC/锁/设备/文件写。

## 先准备，再 dry-run，再明确请求执行

以下示例是接口语法，不是已核定设备坐标；执行前必须替换为当前真实屏幕尺寸/display/可撤销把手区域，并审阅完整计划。

```json
{"op":"prepareTouchSequence","preflightConfirmed":true,"elfPath":"/private/tmp/reader-control-input-build.0wqNmm/reader-control-touch-sequence","elfSha256":"cc1b581bc6cf16449f5f535917fe68cc31cbb031cbc1a00caff8a4a87b02de00","width":1320,"height":2856,"display":0,"plan":[{"atMs":0,"action":"DOWN","finger":0,"x":660,"y":1500},{"atMs":1500,"action":"CANCEL","finger":0,"x":660,"y":1500}]}
```

工具只接受代码内固定审阅 SHA 的 ELF（含 aarch64/ELF64 检查），不接受调用者任意指定可执行文件。计划必须是严格五字段数值数组，2–256 事件、最长 10 秒、两指 0/1、时间不倒退、坐标不出给定屏幕、平衡释放，CANCEL 只能是末尾同时间释放组；display 与 C CLI 同为 0–15。工具生成固定文本并单独计算 SHA，不接收 shell 或计划文件路径。

准备会复制已验字节到新的本地 wx 文件；远端仅在新 UUID `/data/local/tmp/reader-control-input-UUID` 下以无 `-p` 的独占 mkdir 建目录。失败不覆盖/删除旧目录；成功后只向该目录发送两份新文件，再分别回读核 SHA，最后只 chmod 新 ELF 为 700。部分失败文件保留用于检查，不自动删除。完成回执 `touch-prepared.ticket` 仅在同一个仍持有目标锁的 probe 内有效。

```json
{"op":"dryRunTouchSequence","preflightConfirmed":true,"ticket":"从 touch-prepared 回执复制完整 UUID"}
```

票据每次使用先将远端 ELF 与计划分别回读到新本地文件核 SHA。dry-run 调用同一 ELF `--dry-run`，验证原生解析回执的事件数、尺寸、display、dryRun=true，拒绝混入授权/触摸事件；成功才设置票据 dry-run 已通过。它不请求权限、不注入 DOWN。

```json
{"op":"sampledTouchSequence","preflightConfirmed":true,"ticket":"同一 live probe 的已 dry-run UUID","requestAuth":true,"sampleDelaysMs":[0,500,1400,1700]}
```

execute 每次都必须显式 `requestAuth:true`，重新核远端两份 SHA，并要求已通过 dry-run。helper 自己必须从 UNAUTHORIZED 发起新 RequestInjection；不借用、接管或撤销别人的已有授权。shell ELF 是否具备请求权限的应用身份/前台窗口，以及目标库/公开 API 能否运行，仍是原生 OPEN；拒绝后必须停，不可绕过。

所有远端 argv 均由固定命令、验证整数和工具自造 UUID 路径组成，唯一固定 shell 运算符 `<` 将绑定计划送入 helper stdin；用户不能提交命令/额外参数/路径/重定向。传输与该重定向在目标 HDC 上尚须首例核实；任何不支持即终止，不加 shell 兜底。

## 时间与清理的证据边界

最多 5 个严格递增采样延迟（0–10000ms）。`sampleDelaysMs` 相对 **主机收到 helper 第一个成功 DOWN API 回执**；不是进程启动，也不包含等待授权的最长 10 秒。记录 `touch-sampling-origin` 的 host monotonic/UTC、首个 native actualMs/scheduledMs，以及每个 screenCap 实际触发偏移。HDC 输出传输、截图调用与同步回读均有延迟，可能晚于请求采样时间；这些不能伪称精确渲染帧或应用事件时间。

完整 stdout 包括每次授权、每个触摸 API 返回、清理与结束；成功结束还要求 after-revoke=UNAUTHORIZED 的回执。API success 不证明应用实际收到事件，需要独立 `motionLog` 与画面/正文证据。授权失败且没有成功 DOWN 时不触发手势截图。

probe 中断会对其 HDC 子进程发 SIGTERM；这不保证远端进程收到同一信号。C helper 有最长 10 秒序列、调度超时停止和 best-effort CANCEL/撤权，但传输中断、崩溃或平台拒绝时不能保证物理释放。发生此类失败必须停止试验并由设备所有者检查真实手指/授权/前台状态，不宣称“已自动清理”。工具不提供 SIGKILL/任意 kill/任意 shell 入口。

离线门禁：

- `node tools/reader-control-device-probe.mjs --self-test`：实际参数/权限/计划白名单纯校验，无 HDC/锁/文件写。
- `node tools/test-reader-control-device-probe.mjs`：提取实际 runtime closures，模拟传输覆盖独占目录、回读、未知票据、dry-run、字节改变、授权拒绝、DOWN 后采样、撤权缺失；不运行 HDC/锁/设备/文件写。
- `node tools/test-reader-control-touch-plan.mjs`：同一 C 源编译纯解析分支，4 合法/18 非法计划及不可注入 host 门禁；仅本地临时编译产物。

以上均不是原生权限、触摸或动效验收。
