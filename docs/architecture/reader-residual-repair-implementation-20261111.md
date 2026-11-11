# Reader 遗留修复实施记录

2026-11-11。输入为[遗留专题报告](/home/administrator/Reader/Reader-for-HarmonyOS/docs/architecture/reader-open-issues-analysis-and-resolution-20261111.md)，执行依据为用户随后明确要求“全量修复”。本记录区分代码、本地、产物、设备及业务恢复；原0511的失败和原设备范围不改写。

## 当前结果

代码和必要本地检查已分批实施；诊断25个实际用例和独立源码复核通过，统一签名候选待冻结源码后构建。原VM仍为a443，尚无本轮设备安装、取证、下载恢复、原库SQL／FFI或UNKNOWN内容读取。当前真实回执入口为[本轮私有执行计划](/home/administrator/Reader/.local/framework-residual-repair-20261111/execution-plan.json)。

| 遗留 | 已实施内容 | 已有证据／仍开放层 |
| --- | --- | --- |
| F01/F02/F03 | 日志、live header和source-only相等退出正式升级authority；诊断日志匹配OS前缀、PID及消息体起点 | 控制器12实际case PASS；来源缺失明确要求正式proof，不伪造被动端口 |
| F04/F08 | 移除一次可选版本／V1 source相等作为放行依据；正式proof绑定完整Core输入快照／Native／候选／实际执行 | 关闭错误authority风险；未升级Core None语义或指纹域，不声称完整依赖由V1覆盖 |
| F05/F06/F07 | 正式optionalQuery吞空路径退役；替换前BMS与正式源pair重验；ABI、UID及post-install签名／版本fence在start之前 | 真实resolve/install方法与旧安装函数负fixture；新代码阻止UID变化后启动，旧代码实际会越过 |
| F09 | 原live header export不再查询／读字节，正式resolver不调用；无伪造safeRead能力 | 新零查询计数断言；原header即使最终parse拒绝仍读前查询的反例保留；诊断首读／marker也不得读header |
| F10及工具边界 | client/remote状态、nonce framing、固定grant namespace和子进程／lease生命周期独立修复 | 10模块＋7真实本地子进程传输＋8 CLI实际case PASS；独立源码复核无阻塞，不以status0／空输出充当PASS |
| F11/TTS | 精确stop失败时保留取消监听；准确task结算后才off；保留原失败／ID／退休屏障 | 真实旧source FAIL；4个新准确case及既有capability叶共5项PASS；不冒充设备音频结果 |
| L09页码水合 | 区分unknown/loading/confirmed-none/position/retryable-failure；同signature后续普通visible可恢复；多选revision和提交资格fence | 同signature旧源码FAIL；修后恢复、14组实际outcome/selection和SDK watcher PASS；未写Core进度或计数 |
| L13三处装配 | 修display实际源路径和TextDecoder factory、Discover真实共享header接线、drag两处ui路径；显式case选择 | 6准确索引case PASS；display父NAV；未审3 shell／4 display和其他19 P1、4 P1 sibling不续期 |
| 数据与验收 | 准备新候选交付、正式clone事实adapter与一次性额度记账；另列正常两章下载恢复方案 | 尚未恢复离线／冷续读或原UNKNOWN结果；历史2/2→0/2因果仍UNKNOWN |

## 正式升级策略及限制

本轮没有已证明不会激活应用的CLI→现成RuntimeOwner通道，因此没有造新RPC或把普通Want／aa start改称只读。已有应用升级显式使用`--storage-transition`，只接受生产validator的WeakMap-bound handle，不能传`allowed:true`或同source对象放行。

当前已审正式边仅覆盖**x86_64／Library47固定格式**。其他ABI／格式没有已审边时拒绝，不能依签名／源码hash相同猜兼容。此为安全收口的功能边界，不表示arm64或全部物理机已完成升级验证。未来扩展必须新增实际对应格式／ABI证据，不恢复旧日志快路径。

更改后的controller需绑定新的immutable候选。0511及旧a443证明继续保留原字节；不能重写旧manifest/controller snapshot，也不能用当前检出冒用0511 transition。

## 检查选择与证据

只执行本轮改动必需的准确入口，未运行完整产品或历史full套件，也未重建未改变有效输入的Native。SDK、伪平台、方法及真实Node临时文件均注明边界：

- [控制器计划／12case回执](/home/administrator/Reader/.local/framework-residual-repair-20261111/controller/result.json)：compiled marker、退役header零查询、诊断边界、正式proof正反例、陈旧源拒绝、真实安装顺序和UID/ABI。
- [漫画水合](/home/administrator/Reader/.local/framework-residual-repair-20261111/hydration/result.json)：真实旧owner反例、同身份恢复、部分批次只重试失败书、token/旧代/cover/限额、多选和SDK消费。
- [TTS](/home/administrator/Reader/.local/framework-residual-repair-20261111/tts/result.json)：任务／监听退休、迟到ACK／cancel、失败传播及能力降级。其新手动工具仅同目录改名为[diagnose-harmony-tts-background-retirement.mjs](/home/administrator/Reader/Reader-for-HarmonyOS/tools/diagnose-harmony-tts-background-retirement.mjs)，字节和相对依赖一致，不混入test发现／full；原执行路径及日志保留历史。
- [三fixture根重审](/home/administrator/Reader/.local/framework-residual-repair-20261111/fixture-assembly-root-review.json)与[六个索引唯一回执](/home/administrator/Reader/.local/framework-residual-repair-20261111/fixture-indexed/results.json)：仅3文件6case、worker1、无全量；原索引拒绝和后续装配失败保留。
- [诊断v2的25case回执](/home/administrator/Reader/.local/framework-residual-repair-20261111/diagnostics/result.json)：工具默认／list不执行，非显式lineage-only在工具／授权前拒绝；nonce尾帧分离client／remote，原生工具路径重验、固定授权namespace、超时／取消关闭自有子进程后才释放租约。旧live header不读字节，lineage不拥有安装权。
- [交付额度本地检查](/home/administrator/Reader/.local/framework-residual-repair-20261111/delivery/cap-result.json)：8个合成状态／授权／阶段／额度情景PASS，没有真实授权、设备或原数据。

沙箱中曾出现spawn `error=EPERM`却同时有status0；没有把该退出码／file-level结果当作内部case通过。首次失败保留，必要的本地合成子进程检查经环境权限核准后取实际唯一回执。此观察不被追认为旧远端hilog空输出原因。诊断首次实际传输6/7：测试夹具对第二输出块再次发送SIGTERM，在scope清理后误杀parent；修为严格一次信号，原取消／禁止BMS断言全部保留，复跑7/7。根driver曾误填CLI入口，未执行用例；更正后8/8，两个失败日志均保留。

## 数据恢复与最终设备闭环

新停态数据无有效manga head／receipt，0/2与复制事实一致；Host旧文件完整不会自动重建Core候选。源码修复也不会恢复旧evicted。真实离线恢复应使用[正常下载恢复方案](/home/administrator/Reader/.local/framework-residual-repair-20261111/manga-recovery-plan.json)：只针对既有两章，经原下载intent／Coordinator／Core grant／Host materialization流程；可能重新请求同源章节／图片，并受原存储／进度映射／未决操作合同约束。不补SQL头、不改count／tombstone、不重放UNKNOWN。

新设备范围必须绑定本轮最终候选并明确原VM、停态窗口、复制／证明／安装／正常启动／图像总额及失败恢复规则。成功复制后保持停态直到替换前最终重验；恢复启动会失效该proof，且与正常启动共享额度。部署本身仍由canonical inspect/install执行，私有额度工具不提供同意或安装authority。

正式签名包、合法安装、当前候选原生阅读图、漫画业务恢复、历史因果、原UNKNOWN结果、完整回归／物理机／用户验收各自记账。本记录不把代码层关闭写成所有层完成。
