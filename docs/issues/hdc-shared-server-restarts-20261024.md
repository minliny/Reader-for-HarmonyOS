# 无线安装连接与共享 HDC 重启审计

记录日期：2026-10-24。用户要求核对为何反复需要重启 HDC，以及本任务执行过的操作。时间均为 Asia/Shanghai。

## 范围与结论

- 本机 DevEco SDK HDC，客户端和服务端版本均为 3.2.0f；本任务、其他安装任务及 VM 工具使用同一个本机 8710 服务。worktree 隔离不隔离该进程。
- 已确认本任务两次执行 `hdc -s 127.0.0.1:8710 start -r`。第一次之后无线目标恢复并完成旧包安装；第二次未恢复。不能据此认定 HDC 必须定期重启。
- 另一个任务也执行了全局重启，造成服务进程替换。租约只串行化使用包装器的命令，无法约束其他直接调用或 IDE。
- 当前底层连接失败原因仍 OPEN。`Unknown` 不能单独证明手机未授权；此前将它描述为手机授权握手问题并要求反复重启无线调试，证据不足。

## 操作时间线

| 时间 | 操作/观察 | 归属与结果 |
| --- | --- | --- |
| 10-23 23:47–23:53 | 旧端口及用户更新后的端口 tconn，目标 remove 后重连 | 本任务；多次连接未恢复 |
| 23:54:06.965 | `start -r` | 本任务第一次全局重启，租约 acquire PID 95736 |
| 23:54:15.347 | tconn | 本任务；随后连接恢复，23:55 旧包安装成功 |
| 10-24 00:11:51 | DevEco 关闭项目及进程，日志出现 `HdcCommand - exec hdc command succeeded`；旧 HDC 日志在相近时刻结束 | 相关性线索；IDE 未打印具体 argv，不能认定该行就是 kill/restart 或确定操作者 |
| 00:22:28 | 直接 tconn | 本任务，未走租约；这是操作流程缺口 |
| 约 00:23 | 尝试通过租约移除连接，等待 VM probe-session 占用超时 | 未实际执行移除；未抢锁 |
| 00:30:53.720 | tconn -remove | 本任务，持有租约 |
| 00:32:07.009 | tconn | 本任务，挂起 |
| 00:33:22.705 | `start -r` | 本任务第二次全局重启，租约 acquire PID 36956；服务 PID 36979；未修复无线连接 |
| 00:33:42.283–00:36:31 | tconn 等待后终止自己的挂起客户端并释放租约 | 本任务；等待期间占用共享服务租约，影响其他合规命令进入 |
| 约 00:42:40 | 直接 `hdc start -r` | 任务“排查鸿蒙正文加载并优化书籍数据流 (2)”安装回合；之后服务 PID 48581。本任务此阶段仅做只读审计 |

本任务还执行了目标列表、版本/服务检查、路由/进程/socket 检查和独立 TCP 可达性探针。没有卸载或清除应用数据，没有修改手机设置或重启手机。上表的全局重启影响所有设备会话，并非仅重建手机连接。

## 当前证据与边界

- 本机到无线目标的路由为 en0。未观察到该连接经 utun；这不足以排除所有网络过滤行为。
- 服务 PID 48581 到无线目标的 socket 曾处于 SYN_SENT，后为 CLOSED；同期独立 TCP 探针约 64 ms 成功。VM socket 为 ESTABLISHED。说明普通端口可达不等于 HDC 会话已建立，不能把该样本归因为认证拒绝。
- 尚未取得证明 HDC 连接失败原因的报文、系统网络过滤日志或完整错误返回；不能确认是 HDC 内部状态、按进程过滤、对端接入状态或间歇网络故障。
- `scripts/hap-pipeline.mjs` 的 runTargetHdc 和 `tools/reader-hdc-lease.mjs` 没有自动重启逻辑。后者将原 argv 交给子进程；等待租约有期限，子命令本身没有执行期限。长时间 tconn 会持续持锁。
- 第一轮重启恢复连接与第二轮重启无效都保留；不把先后相关当作根因证明。

## 已采取的处置与后续边界

- 本次审计停止了盲目重启和持续重连，不再把 Unknown 等同于手机授权故障。
- 本任务后续连接操作须走共享租约并限制单次等待时间；全局重启不能作为普通目标重试的默认动作。
- 多任务共享服务应统一维护 owner；这是建议，尚未改造工具或向其他任务发送指令。
- 下一步定位应针对同一时段的 HDC socket 失败和服务端返回，保留现有进程证据；不以重新安装应用来处理传输故障。
- 新修复的真机安装及交互验收仍 OPEN。此前 run `20261023T163635Z-6b1bd753-64fb4e59` 已被后续发布回收 HAP，manifest 留存；不能继续声称该 HAP 仍可安装。后续候选包须重新核对 manifest、修复源码和目标身份。

## 证据索引

- 本机临时目录 `reader-hdc-target-leases/events.jsonl`：acquire/command-exit/release 时间与 argv，原始记录保留在本机，包含私有目标信息。
- 同一临时目录的 `hdc-20261024-001151944.log`、`hdc-20261024-003322737.log`、`hdc-20261024-003324041.log` 和审计时的 hdc.log；日志自动轮转，文件名不能单独作为重启证据。
- `/Users/minliny/Library/Logs/Huawei/DevEcoStudio26.0/idea.log` 约 53355–53425 行，IDE 关闭阶段。
- 任务“排查鸿蒙正文加载并优化书籍数据流 (2)”（01a16965-e6e5-7451-a61b-f7b8bfbc4669）本次“安装”回合，明确记录直接 `hdc start -r`。
- 当前任务命令回执与只读 route/lsof/版本检查。仅做本机链路审计，无新增设备 UI 抓取或业务回归。

## 用户授权全量修复后的实施

范围为 HDC 既有统一入口及其实际调用方，不改其他 worktree，不修改 SDK 二进制或系统代理。当前主分支全部 dirty 输入统一进入 iteration 构建。

- lease 在调用前校验 server/target，归一化本机别名，固定 -p 禁止自动起服务，拒绝 start/kill/reconnect/子服务等维护命令。普通/文件/安装分别有30/120/180秒上限，可缩短不可提高。
- 超时先 TERM、1秒后 KILL 自有客户端，等待 close 后释放；持久化 childPid，父进程死亡但客户端存活时不回收。UI probe 空闲60秒、总会话10分钟；取证命令超时强制结束自己的客户端，空闲退出非成功。
- fast capture 检查零退出码传输错误并停止后继请求。pipeline 就绪检查改用相同包装器执行期限，父进程期限包含等锁和清理时间，避免原10秒外层期限先杀包装器。
- 工作区受控 AGENTS 和部署技能引用已同步，明确手动 discovery/tconn 也不得绕过租约。外部 IDE/原始 SDK 仍不受该工具技术拦截；没有宣称已阻止全部外部调用。

必要验证及嵌套：HDC lease 的 command-policy/timeout/orphan-child/serialization/wait-barrier/stale-token/signal 使用实际CLI或生产锁API+临时假HDC；probe-idle/capture-stop 使用实际生产工具+假HDC；input-tools-and-lease 核对受新命令准入影响的原fixture；probe command-guards/sampler-routing 核对改动的实际闭包。无真实设备、SDK、产品测试或隐式全量。上述共12项 PASS。首次timeout fixture给Node启动仅500ms，未到ready；改为1500ms并保持真实超时/KILL/退出码断言后通过，未调整生产预算。索引仅更新这两个修改后的测试定义及5个新增精确case。

当前无线目标仍Offline；单次有界tconn返回repeat operation而未恢复，已停止重试，不重启共享服务。后续安装需当前准确目标Connected及规范inspect通过。

### 明确授权的服务维护

用户确认无线地址未变，并拒绝管理员抓包，明确要求“你重启 HDC”。因此增加独立 `--maintenance-reason` 维护模式：必须 target=maintenance、非空单行原因、唯一命令 start -r；只在租约立即空闲时进入，等待时间固定0，执行上限10秒。普通入口仍拒绝维护命令；原因进入owner和事件记录。命令准入新增正反例PASS。本轮核对租约空闲后仅执行一次授权重启，随后一次10秒真机连接。未启动管理员抓包。

### 本轮交付结果

- 最终 signed iteration run：`20261023T173054Z-6b1bd753-2514070c`。SHA-256：`e9634259f22b61d1758fe3de560b41bf76f3f7aa499d24e086f4f6c8888a4ad5`。指定 minliny_HarmonyOS 证书和 debug Profile 验签通过；Host main 6b1bd753、Core main 9131ddcf 均如实记录 dirty。包覆盖当前应用全部构建输入，HDC 本机工具修复归入控制器/工作区记录，不伪称其运行在手机内。保留10次成功构建。
- 完整 ArkTS/Native 打包成功；构建输入共2035个，前次相同应用内容快照逐文件核对无差异。构建工具修改不改变应用指纹，但新的controller快照随最终run归档。未运行全量产品回归，不计功能/用户验收。
- 用户授权的一次重启后 HDC PID由48581变为1282，确认确有重启；VM恢复Connected，但手机仍Unknown，socket为SYN_SENT。普通TCP同端口约55ms成功、系统代理关闭、路由en0。尚不能确定具体丢包/进程差异原因。用户拒绝管理员抓包，因此未执行该取证。
- 最终规范 `inspect --artifact signed --target-kind physical` 退出1，原因 `the exact HDC target is not connected`。尚未进入设备就绪/BM预检与安装，未卸载/清数据；physicalInstall、launch、featureInteraction、userAcceptance 均OPEN。不能把HDC防护修复或构建通过当作连接故障解决。

### 用户重启无线调试后更新端口

用户提供新连接端口40909。本任务通过统一租约进行一次10秒有界tconn，退出124；目标列表仍Unknown，服务PID1282未重启，对该端口的socket为SYN_SENT。同一电脑独立TCP connect约60ms成功。通过系统设置只读核对，ChatGPT与DevEco-Studio的本地网络权限均开启，未修改任何权限或系统设置。新端口规范inspect仍停止于目标未连接，新包未安装，保数据语义未改变。单凭上述差异不能断定手机认证或某个网络过滤器为根因。

### PC 端进一步定位（同一服务 PID 1282）

- 系统防火墙为 disabled；系统 HTTP/HTTPS/SOCKS/PAC 开关关闭；当前目标路由 en0。Tailscale 扩展存在，但当前 VPN disconnected。不能仅凭扩展存在归因。
- 修正代理描述：HDC 继承 http_proxy/https_proxy/all_proxy，指向本机7890，但该端口无 TCP listener；HDC 实际 socket 指向无线目标。上游 host_tcp.cpp 的 ConnectDaemon 使用 uv_ip4_addr + uv_tcp_connect，并无环境代理分支；上游版本不是本机3.2.0f逐字源码绑定，因此不把代理因素绝对排除。
- 使用只读 proc_pidfdinfo(PROC_PIDFDSOCKETINFO) 获取系统 socket 状态：fd30（旧端口）、fd36（新端口）均 tcp_state=0/CLOSED、soi_error=60/ETIMEDOUT、soi_state=0x2130。两者持续保留在HDC中。同期独立Python探针连接新端口成功508ms；此前Node/libuv亦成功19ms。失败发生在TCP建连层，不能描述成已经进入设备授权握手。
- 当前HDC日志对无线目标仅记录 start tcp connect，未找到相应Connect成功或失败回调；主线程采样仍在uv_run/kevent，VM连接ESTABLISHED。确认失败连接残留；不能仅凭回调日志缺失断言具体libuv缺陷。
- responsibility_get_pid_responsible_for_pid 返回HDC1282归属自身；普通Python探针归属ChatGPT5866。ChatGPT与DevEco的Local Network开关均已开启。Apple TN3179说明macOS本地网络权限按responsible code归属，因此独立HDC的归属差异是待验证线索，尚无拒绝日志或启动方式A/B结果，不能写成已确认权限拦截。
- 系统日志未取得匹配HDC的明确网络拒绝记录。没有执行管理员抓包、关闭网络保护、修改权限、启动第二个HDC服务、切换服务端口或再次重启。
- 本轮有一次直接运行SDK `hdc -v` 用于观察短命进程归属，未经过租约。该命令只返回版本且不接触服务，但不符合项目统一入口规则；已记录，不把只读性质作为流程例外，后续仍全部走租约。
- 只读取证临时文件：/tmp/reader-hdc-pc-sample.txt、/tmp/reader-hdc-socket-info.c；未改应用构建输入。待安装候选仍为20261023T173054Z-6b1bd753-2514070c，安装OPEN。

参考：https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy ; https://raw.githubusercontent.com/openharmony/developtools_hdc/master/src/host/host_tcp.cpp

### 用户批准的前台启动对照结果

用户明确回复“允许做一次对照”。操作前统一租约目录无活跃owner，未发现正在运行的pipeline/probe/capture；DevEco界面无运行/调试任务，保留设备列表监听，Emulator进程保持运行。通过现有acquireLease/releaseLease API取得原serverKey租约，维护原因和实际命令追加到同一事件日志；没有创建另一个锁域或服务端口。

- 01:51:14（Asia/Shanghai），在租约内用 `-p -s 127.0.0.1:8710 kill` 结束准确旧服务1282，确认监听消失后启动同一SDK `-m -s 127.0.0.1:8710`。没有使用start -r再派生后台进程，也没有修改系统权限、代理或手机状态。
- 新前台服务PID33008，父进程32986；responsible PID5866（ChatGPT），旧后台服务responsible PID1282（自身）。新服务仍继承当前进程环境，未删除代理变量作为附带变量。
- 仅一次新手机端口tconn，约349ms返回Connect OK；随后的targets同时显示手机与原VM Connected。手机socket ESTABLISHED。没有第二次tconn或重启。
- 对照支持故障与PC上后台服务运行/权限归属有关；由于更换进程同时清空了SDK内部状态，本次不能单独证明macOS本地网络权限拦截，也不能把它与SDK后台状态缺陷完全区分。
- 已成功执行旧候选173054的规范physical inspect：签名、Profile、应用身份、boot/SceneBoard稳定性均PASS，preservesData=true。尚不能将inspect等同安装。
- 为完成已有安装任务，暂时保留单一前台服务，完成对照后释放命令租约；后续pipeline继续按统一租约串行使用，未永久占有共享锁。前台服务由本次会话父进程持有，不是已完成持久化修复。
- 复查当前源快照发现LocalReadingExperience.ets、ReaderPageGestureState.ts、ReaderPageInteractionLayer.ets较173054候选有后续更新；按用户“当前分支所有修改同包”要求重新执行规范iteration构建（contracts none），没有安装缺少上述更新的旧候选。

对照脚本和原始日志仅在忽略的 `.reader-local/diagnostics/hdc-foreground-comparison.mjs`、`hdc-foreground-comparison.jsonl`、`hdc-foreground-server.log` 中保存；含私有目标，不进入Git。该一次性脚本调用生产lease API承载已授权维护，不作为普通入口放宽命令准入。
- 第一次合包175248-d4f77d48构建及physical inspect PASS。构建后源文件LocalReadingExperience.ets又被正在收尾的“修复左手拇指弧线翻页”任务更新，故未安装该中间包；只读等待其完成后重新定版。保留策略维持10包，173054候选HAP已由规范流水线回收，manifest与历史仍在，不能再把173054称为可安装包。
- 第二次最终合包尝试1792778239871-347041a8-bae6-46f1-96ae-e50a1d2b22d2编译完成，但被构建末端controller/gate输入变化校验拒绝（4390bc81→3a4034cc）。并行任务正在修改测试登记，仍属于控制器快照范围；此次未发布HAP、未安装、未放宽一致性检查。等待并行任务完整结束，不只等待产品源码稳定。
- 最终run180007-576a397b构建与签名PASS，2035构建输入逐文件对照无差异；首次physical inspect在只读readiness阶段报告Physical boot identity or uptime changed during readiness observation，未进入安装。HDC未重启。代码定位到physicalBootSample双采样条件，现有错误未区分milestones、bootStart量化、guest/host时间差；先进行一次带字段记录的相同生产readiness探针以确定失败分支，不降低就绪要求或盲目重装。

## 2026-10-24 02:04 真机安装结果

- 当前main全部应用输入合包run `20261023T180007Z-6b1bd753-576a397b`；2035个输入与安装前当前源逐文件一致。Harmony 6b1bd753、Core 9131ddcf均如实保留dirty。signed HAP SHA-256 `a3de135a67e12a4c6f9c4afd96b3d714855100d783e7f8e2be5008ee02494dea`，指定minliny_HarmonyOS证书与debug Profile验签通过。
- 手机targetRef `2141c5a269b2`，规范inspect最终PASS；install -r成功，安装后包身份匹配核验通过，未卸载或清除数据。规范安装标记的resolution记录installOutcome=PASS。
- 自动启动失败：10106102，手机锁屏，开发者模式不允许自动解锁。没有关闭开发者模式或改手机权限；安装成功与启动失败分别记录，交互/用户验收仍OPEN。
- 当前pipeline在启动失败时提前抛错，未生成完整deploy回执；保留 `.reader-local/diagnostics/final-install.log` 和manifest同目录的 `resolved-retention-install-physical-2141c5a269b2-ed130db4-e903-4b9f-bf97-37260fd79d92.json.resolution.json`，不得伪称已有完整部署PASS回执。后续启动确认单独补证，不用重复安装掩盖失败。

- 用户解锁并明确要求启动后，经原共享HDC租约执行aa start成功（start ability successfully），pidof确认Reader进程28527。未重装、未重启HDC、未清数据。启动跟进记录：`.reader-artifacts/hap/20261023T180007Z-6b1bd753-576a397b/launch-followup-physical-2141c5a269b2.json`；此前锁屏失败保留，功能交互与用户验收仍OPEN。
