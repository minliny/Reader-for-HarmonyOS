# HDC 服务路由（2026-10-27）

用户指定：远程 VM 使用 `192.168.1.10:8710`；本地 VM 和真机使用 `127.0.0.1:8710`。VM 的 target 是对应服务所见标识，不能单凭 loopback target 区分本地与远程。现有 HAP pipeline 只有 `vm|physical`，默认本机服务，允许环境变量覆盖，但未校验物理设备与服务匹配，也未在设备预检或回执中保存服务身份。

本次仅改 inspect/install 的服务路由和回执：新增显式 `--vm-location local|remote`，兼容未传该参数时现有的本机默认和显式 `READER_HDC_SERVER_KEY`；以同一 resolved server 驱动 HDC 子命令和租约。无关构建、签名、HAP 字节处理和设备操作不变。最小验证为独立纯逻辑和受控装配测试：检查本地默认、远端显式选择与原环境变量兼容、冲突及 physical 指向远端拒绝、inspect/receipt 绑定服务身份；无需运行设备、全量业务、构建或签装。旧部署回执为历史记录，不改写。

本次 `node tools/test-hdc-deployment-routing.mjs` PASS：覆盖物理/本地/远端路由、别名、位置与环境冲突、远端物理机拒绝，并用受控 runner 检查租约 server、HDC 参数和 receipt 服务字段；没有调用 HDC 或设备。`git diff --check` PASS；真实目标/连接/设备行为待后续现场验证。

## 本机前台启动监听核验误判（2026-10-27）

现象：上一轮本机前台 HDC 日志记录进程初始化 8710，但前台入口在 10 秒后称无法确认监听并回收自有子进程，尚未执行 tconn。源码定位：`reader-hdc-foreground.mjs` 同时要求 `netstat` 仅一条 LISTEN、`lsof` 唯一 PID 及 TCP 连接。当前执行环境的 `netstat -an -p tcp` 返回 0 却不列任何 LISTEN：本轮本地 Node 测试 listener 在动态 loopback 端口已实际接受 TCP，`lsof` 返回本进程 PID 和地址，`netstat` 仍无对应端口。旧 HDC 当时的 TCP/lsof 原始样本未保留，不据此推断当时真实监听状态。

当前机器 `lsof` 对无关 WebDAV 挂载 stat 发出固定三行警告。以本机 IPv4 和 IPv6 不同进程同时监听同一动态端口的局部探针核验，`lsof -iTCP:<port> -sTCP:LISTEN -Fpcn` 同时返回两进程、两地址及此警告；该样本只证明这里两条真实 socket 不受此警告遮蔽，不证明任意权限或错误均安全。修复拟移除不可用的 netstat 成功前置，同时严格解析 lsof 的 TCP socket 及端口，限定仅已识别的 WebDAV 三行警告，其余错误/警告/畸形输出停止；就绪还须唯一 listener PID 等于本次 child、地址为本机 loopback、child 运行且实际 TCP 可连接。旧服务、未知 listener 或检验不完整不得启动或接管。

选定验证：扩展 `node tools/test-reader-hdc-lease.mjs --case foreground-policy` 的纯逻辑负控，以及新增真实本地 TCP listener 子进程回归；仅执行宿主 loopback 假进程、生产观察方法和锁策略，不调用 HDC、网络设备或其他门禁。真实 HDC 和真机安装独立记账。

结果：`foreground-policy` PASS；`node tools/test-hdc-foreground-loopback.mjs` PASS：真实子进程绑定 `::ffff:127.0.0.1` 时，lsof 报告 `127.0.0.1`、唯一 PID 与进程名匹配且 TCP 可连；第二个真实子进程在同端口监听 `::1` 后，准确发现两个 PID 并拒绝作为唯一 listener。未知警告和不完整记录负控均 PASS。没有调用真实 HDC 或设备。该回归解释旧检查会在当前环境错误拒绝可用监听，但不证明旧 HDC 实际已监听或已连真机。
