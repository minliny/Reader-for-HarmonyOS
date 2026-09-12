# 独立触摸序列诊断器

仅用于主代理明确授权的控制栏输入采样，不接入 Reader 产品、不修改 SDK、不含 HDC/设备发现/服务启动。程序成功只表示公开 API 调用完成；实际应用事件、指针所有权、画面与业务结果必须另采。未执行设备注入。

## 本机确认的公开能力

本机 SDK `/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony`，ETS metadata API 24 / 6.1.1.125：

- `ets/api/@ohos.UiTest.d.ts:4476`：`Driver.injectMultiPointerAction(PointerMatrix, speed?)`；`:5431` / `:5458`：`create(fingers, steps)` / `setPoint`。仅1–10指、1–1000步、坐标与整体速度，没有逐步时间或 Cancel；重复坐标不能据此认定精确 HOLD。
- `:4105` / `:4139`：`longClickAt(point,duration?)` / `dragBetween(from,to,speed?,duration?)`；duration仅长按或拖前停留，最小1500ms，均为 `@test`，不是当前 probe 的任意触摸原语。
- `native/sysroot/usr/include/multimodalinput/oh_input_manager.h:148`：CANCEL/DOWN/MOVE/UP；`:1133`、`:1181`–`:1269`：公开 `OH_Input_InjectTouchEvent` 及 action/finger/坐标/time setter；`:1497` / `:1511`：`RequestInjection` / `QueryAuthorizedStatus`。API20起注明先请求授权，并仅在 AUTHORIZED 时使用。
- SDK 的 `SetTouchEventActionTime` 注释没有单位。本工具不编造微秒/纳秒，按真实 monotonic 调度注入调用，平台生成事件时间；需从应用实际收到的事件核对时间戳。也不假定每个指定 finger ID 一定原样抵达 ArkUI。

## 安全与可行性边界

使用前由唯一设备所有者重新核实 AGENTS 的目标/系统就绪/锁、目标 API与 `libohinput.so`、Reader前台窗口、当前display和屏幕尺寸、允许操作区域。此工具不检查这些条件，也不取得或替代设备锁。首个原生试验应仅为可撤销的小横条长按/CANCEL，并同步采真实 DOWN/UP/Cancel、heldPointerId、epoch、p/v；不得直接跑跨页面业务坐标。

工具必须完整预解析 stdin 后才请求权限；最多256事件、10秒、finger0/1、给定viewport内坐标，拒绝时间倒退/重复DOWN/无DOWN的MOVE或终止/未释放EOF。CANCEL必须是末尾释放组，同组其余活跃指针在相同时间CANCEL；不在Cancel后重启或继续移动。

执行要求双显式开关 `--execute` 和 `--request-authorization`。先查询为 UNAUTHORIZED，调用 RequestInjection一次且仅接受 INPUT_SUCCESS，最多等10秒确认AUTHORIZED；已有授权/其他授权/重复授权中/服务错误均拒绝，不重试请求。shell ELF是否有可接受的应用身份、前台要求及系统授权UI，仍未原生确认。权限拒绝不能改用内部API、直接设置授权或伪造测试身份绕过。

中止/SIGINT/SIGTERM/SIGHUP/日志管道丢失/调度迟到超100ms/注入失败后，停止后续事件，对所有可能按下的指针 best-effort CANCEL，撤销本进程已获受理的注入请求并记录最终授权状态。SIGKILL/进程崩溃/系统拒绝CANCEL不能保证物理释放；此时必须停止试验、检查原生状态，不能将清理“尝试”写成成功。未取得本进程请求受理时，不撤销原有/其他应用授权。禁止通过对运行进程发SIGKILL模拟应用TouchCancel。

所有API返回码及授权状态保留在stdout JSONL；退出2=计划/CLI错误，3=授权/host-only阻止，4=时序/输入/清理异常。运行结束会主动撤销自己取得的注入授权，因此前后应均为UNAUTHORIZED；保留原始日志而不是只看退出码。

## 本地编译，不连接设备

在仓库根目录执行；这是独立诊断 ELF，不是 HAP 或正式产品构建入口。产物目录使用新的 mktemp，勿复用/覆盖已有交付包。

```sh
reader_touch_build_dir=$(mktemp -d /private/tmp/reader-control-input-build.XXXXXX)
/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/native/llvm/bin/clang \
  --target=aarch64-linux-ohos \
  --sysroot=/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/native/sysroot \
  -std=c11 -O2 -Wall -Wextra -Werror -fPIE -pie \
  tools/native/reader-control-touch-sequence.c \
  -L/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/native/sysroot/usr/lib/aarch64-linux-ohos \
  -lohinput -o "$reader_touch_build_dir/reader-control-touch-sequence"
```

已核生成 aarch64 PIE，解释器 `/lib/ld-musl-aarch64.so.1`，动态依赖仅 `libohinput.so` 和 `libc.so`。不引入 libc++、额外服务或依赖。推送、chmod、执行由主代理另决，不在本工具自动进行。

本机纯解析回归：`node tools/test-reader-control-touch-plan.mjs`。它用同一C源码的 `READER_CONTROL_DRY_ONLY` 分支编译，编译时排除所有注入API；4合法/18非法计划、CLI、host即使给execute仍禁止注入均通过。不能将这些测试说成授权/失败清理的原生验证。

## 计划格式与运行界面

每行 `at_ms ACTION finger_id display_x display_y`，时间相对于获授权之后的序列起点；时间间隔形成HOLD，MOVE就是一个真实注入样本，不自动插值。调用者应提供足够的中间坐标来表达拟测试路径，不把稀疏点当连续帧证据。示例仅演示语法，不是已核定设备坐标：

```text
0 DOWN 0 660 1500
100 MOVE 0 660 1200
600 MOVE 0 660 1400
800 UP 0 660 1400
```

本机或目标解析（不会请求权限）：`reader-control-touch-sequence --dry-run WIDTH HEIGHT --display DISPLAY_ID < reviewed-plan.txt`。

主代理确认安全前置条件后才可选择执行：`reader-control-touch-sequence --execute WIDTH HEIGHT --display DISPLAY_ID --request-authorization < reviewed-plan.txt`。WIDTH/HEIGHT/DISPLAY_ID须替换为当前真实值，不直接复制示例。采集 stdout JSONL 与应用侧事件/画面；`scheduledMs`和`actualMs`是注入调度时间，不是渲染帧时间。
