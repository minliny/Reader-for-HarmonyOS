# 交付前只读 VM 前置检查（2026-09-13 20:35–20:39 CST）

本次不安装、不启动应用、不点击、不重启/停止 VM 或 HDC、不删除锁。已读项目 AGENTS、HAP_BUILD_SYSTEM、reader-harmonyos-hap-pipeline SKILL 和 deploy reference。

## 已确认身份

| 对象 | 本次只读现场 |
|---|---|
| VM进程 | PID 21552，PPID 78563，2026-09-13 02:10:36启动，状态S |
| VM名称/路径 | `Mate 80 Pro`，`/Users/minliny/.Huawei/Emulator/deployed/Mate 80 Pro` |
| Emulator argv | `/Applications/DevEco-Studio.app/Contents/tools/emulator/Emulator -hvd Mate 80 Pro -path /Users/minliny/.Huawei/Emulator/deployed -t trace_80979_commandPipe -imageRoot /Users/minliny/Library/Huawei/Sdk` |
| HDC共享server | PID 75381，2026-09-13 01:38:10启动，`hdc -m -s ::ffff:127.0.0.1:8710` |
| 当前活动控制探针 | PID 74395，PPID 77830（本ChatGPT app-server），02:33:13启动，`node tools/reader-control-device-probe.mjs --target 127.0.0.1:5555 ... --server ::ffff:127.0.0.1:8710 --output-dir .../evidence/2026-09-13-vm-retry` |
| 探针TTY | lsof确认stdin/stdout/stderr连接 `/dev/ttys001`，进程仍活着；没有活跃HDC子命令 |
| 旧target锁 | `/private/tmp/reader-hdc-target-leases/6460677a198b.lock/owner.json`，owner PID38165，本次ps无该进程；未改动。快照见相邻 `preflight-20260913-legacy-target-owner.json` |
| 现行server锁 | canonical `127.0.0.1:8710` hash `a29f70813dca`，检查时没有对应lock目录；不因此推定长期旧探针已释放控制权 |

## 系统已有证据

当前Emulator启动周期02:10:59.385记录 `Guest OS Boot Completed!!`，之后无新启动周期。已截取本次周期原始日志到 `preflight-20260913-emulator-current-session.log`。20:33附近存在Host MacTaskCall timeout，不能据此归因Reader，也不能直接视为guest崩溃。

最新本地guest hilog覆盖20:23至20:37，持续每分钟记录同一渲染进程791绘制SceneBoard，未找到 `LIFECYCLE_TIMEOUT` / `SceneBoard exits 4times` / `kernel panic` / `guest reset`。完整来源路径、snapshot字节SHA256、首尾时间、SceneBoard与fatal筛选原文见 `preflight-20260913-host-log-summary.json`。这证明系统当前仍产生日志，不替代fresh HDC参数读取。

## 控制owner归属与安全释放入口

PID74395对应ready日志 `reader-control-probe-1789237994104-d4bdee59-9d1d-4b3f-8f89-a1d9b614c866.jsonl`；该文件02:34:09后无更新，说明闲置但仍存活，不能冒充已释放。

原始当前任务会话证据：`/Users/minliny/.codex/sessions/2026/09/11/rollout-2026-09-11T00-03-56-01a074bb-777c-7022-9ce9-c6518d63a335_01a08c0f-bd14-7b73-9b39-f1d30c528fb5.jsonl` 中，2026-09-12T18:33:15.098Z，call `call_xAAdWIVg962tZmqsvDS1Hvpm` 返回该ready文件及统一exec `session_id:6759`。它属于本任务此前的冷启动验证。

已通知root可以通过原会话6759发送工具正常 `{"op":"quit"}`，由探针自己关闭并释放其控制资源。子agent没有发送该指令、杀进程或删除任何锁。

fresh `list targets`、`bootevent.boot.completed` 与当前SceneBoard进程检查暂缓至owner协调完成；不能仅因server新锁为空，绕过活着的旧控制探针。后续只读检查须仍经当前shared-server lease串行执行，任何连接失败不自动重试或重启HDC。

## 20:39–20:42 CST 后续门禁结果

root在原会话6759发送正常quit，2026-09-13T12:39:04Z取得exit0及closed/quit-or-eof；本次随后ps确认PID74395已经退出，VM21552/HDC75381身份和启动时间保持不变。

四次读取全部经当前 `reader-hdc-lease.mjs`、canonical server `127.0.0.1:8710`、`--wait-ms 0`、`-p`禁止服务自动启动、明确target `127.0.0.1:5555`，串行执行：

1. 20:40:04 fresh targets：VM `127.0.0.1:5555 TCP Connected localhost`。另外有USB Offline目标，未选择或连接，保存列表已脱敏。
2. 20:40:36 `bootevent.boot.completed=true`。
3. 20:40:56 SceneBoard实际PID1529，`ohos.sceneboard`。
4. 20:41:35 同PID1529仍可读取stat，状态S，确认39秒内未换进程；附带uptime读取被guest权限拒绝，已原样记录且未重试，不能把该字段当已取得。

Emulator当前启动周期的Guest OS Boot Completed与最新持续SceneBoard日志无系统超时/退出循环的证据结合，**现有VM启动/传输/SceneBoard前置门禁通过**；这不是HAP安装/Reader启动/功能交互或用户验收。

相邻四份 `preflight-20260913-fresh-targets.json` / `boot-completed.json` / `sceneboard.json` / `sceneboard-stability.json` 保存明确argv、时点和原始结果（物理标识脱敏）；`preflight-20260913-lease-receipts.json`保存四次acquire/command-exit/release。最终server lock不存在，本子agent没有保留控制owner。旧target lock仍未改动，后续使用现行server lease与pipeline，不手工删旧锁。

后续由root持当前唯一verified signed manifest做保数据inspect/install；本子agent的设备工作在此结束。
