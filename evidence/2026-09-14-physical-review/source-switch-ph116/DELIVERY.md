# PH114–PH116 合并交付记录

日期：2026-09-17。范围包括刘海顶部与正文布局、字号发布闪烁、换源和阅读错误边界、详情20章和完整目录接线。此前PH104–PH113未提交修复完整保留。代码修复/构建阶段未操作设备；用户随后明确要求安装，保数据真机更新记录见下文。

## 源码与本地证据

- Harmony：`5fb96de4cf322c9b4f35c558051ba1fea5196ad5`，dirty。
- Core：`bf49495317798f68b98928712eb6e106af02bed1`，dirty。精确输入及原始NAPI见`core/CORE_REPORT.md`，不以不含dirty内容的buildId判定源码一致。
- PH114：`../cutout-top-ph114/REPORT.md`，含200项几何/实际方法样本、设置回滚及系统字号测量路径。
- PH115：`../appearance-reflow-ph115/PROBE_REPORT.md`，旧Stage红证据及16组新发布回归，旧页仅使用其已测字体。
- PH116：`ENTRY_REPORT.md`、`HOST_INTEGRATION.md`、`SOURCE_SWITCH.md`；详情与Figma见`../detail-directory-ph116/REPORT.md`。
- 所有新入口均复用现有协调器、gateway、Core原子事务及现有匹配路径。没有恢复已否决的续读缓存，也没有复制Legado GPL代码。

## 最终正式产物

唯一HAP流水线最终于2026-09-17 00:50北京时间通过，独立manifest复验及原生库可重复strip比对也通过。最终第四次运行：

- Run：`20260916T165029Z-5fb96de4-1d4e16c4`。
- Manifest：manifest.json（原始证据仅本地保留）。
- 签名HAP：entry-default-signed.hap（原始证据仅本地保留）。SHA256：`4d730cb32fcce99f1ddc2d590b311007456fdf14c6fd928a0abefa7956b2b837`。
- **293项Harmony合约、ArkTS编译、隔离无增量构建、debug签名与独立复验PASS**。原始日志`hap-build.log`和`hap-verify.log`。编译仍有工具记录的警告，不声称无警告。
- Source fingerprint：`1d4e16c4265fcaeed65bc4a94ef860111c8798019e7fe74932e0d848ac1bb604`；controller fingerprint：`da52ac1c52d80a4712876242da6a2a2174f57e8cc30e8ea874c6655063b1ce80`；workspace contract fingerprint：`4df3dcc01332d05019d75f7f17572663ed67aa29a9ca6f44a65f06fec7257d9c`。
- 原始NAPI SHA：`d63ac03b7f191f41a75b54496d1f30869c57413fd1639459fe51bc7d3b915d99`；包内strip后SHA：`e12677db6221a52d2537dfa8d4cc9312d666ebd18694e200c51757501eb49ff8`。通过既有provenance工具比对Core包、Host输入及签名HAP，不只检查buildId。
- 构建后再次验证Core的7个dirty源码内容与原生构建前收据一致。完整回执为`final-delivery-verification.json`；额外迭代版血缘记录为`iteration-provenance.json`及其日志。
- 两仓dirty；`buildClass=iteration`、`acceptanceEligible=false`。额外provenance使用显式`--allow-dirty`，不将该包升级为clean acceptance，不代表设备或用户验收。

### 失败与重跑记录

正式流水线第一次尝试在本地合约阶段失败：`test-bookshelf-reading-entry.mjs`仍提取已删除的`retryCurrentReadingSource`旧退出弹框方法，未进入ArkTS构建或发布产物。原始日志保留为`hap-build-attempt-1.log`；测试需按最终正文页内恢复合同更新后，重新执行整条流水线，不能沿用此前子任务的绿结果。

该测试已移除两个未再使用的旧方法提取，并让实际Shell回调探针捕获新的身份闭包；原入口、错误留页、串行退出保存、保存失败重试/取消、旧dialog隔离与分层返回断言均保留并通过。未改生产行为；随后重跑正式流水线。

第二次正式尝试通过书架等前序合约后，在`test-reader-continuous-reading.mjs`的旧静态表达式断言停止。生产触摸层新增了错误页/换源错误门禁，避免遮住恢复按钮；旧断言仍要求表达式直接从paged条件开始。精确补入两项错误门禁后，原live List避让及非错误空投影中心控制条件仍全部保留，专项PASS。原始日志为`hap-build-attempt-2.log`；该次也没有发布产物。余下脚本先逐项保留最终preflight结果，再重跑完整正式流水线。

后续200项只读preflight完整执行：198 PASS，2 FAIL，见`final-preflight/results.json`及各项日志。两项分别为`test-reader-source-failure-p0`仍要求已删除的错误退出后详情换源动作，以及`test-search-detail-cache-first`仍要求resumeImmediately写在fallback布尔式内；现行代码在该布尔式前已直接进入阅读并return，并新增pending显式换源保护。测试改为验证最终错误留页/正常退出和真实前置return/待处理事务限制，其他原保护保留；两项专项PASS后冻结，重新执行完整正式流水线。

第三次正式尝试293项Harmony合约全部PASS，进入隔离编译后在Index的4处`catch`直接重新抛出未限定类型值触发`arkts-limited-throw`（4620、4629、4759、4762行）。原始日志`hap-build-attempt-3.log`保留；该次无最终HAP发布。修正须保持Error/ReaderCoreRequestError对象、错误码和details，不可改成字符串或丢失事务语义。

四处已补`as Error`编译期断言，运行时仍抛出原对象，不包装或改写code/details；已被`instanceof ReaderCoreRequestError`收窄的后续分支保持原样。实际direct-entry-recovery与source-switch-transaction再次PASS，然后冻结并执行第四次正式流水线。

## 设备和验收边界

- 本次安装前真机为PH113：`20260916T144055Z-5fb96de4-2d6e0f65`，签名HAP SHA `e2cc8c8f14e896d519255d86adc2df6c985839a13c85533f169a29764317521a`。PH114中间包`20260916T154422Z-5fb96de4-be051bef`未单独安装。
- 2026-09-17 08:34:15北京时间，用户明确要求“安装到真机”后，本轮最终run `20260916T165029Z-5fb96de4-1d4e16c4`保数据覆盖安装、安装后身份核对、EntryAbility启动全部PASS；原目标设备，回执仅本地保留。本次没有操作同时在线的VM，VM/真机功能交互/用户验收OPEN。
- 本地同步路由验证的是进入正式阅读页的逻辑，不是网络正文瞬间到达或设备端帧耗时证明。解析失败保留阅读页、设置、重试和换源。
- OEM状态文字的精确字形/基线/左右padding、状态栏颜色及字体调整连续帧效果仍需同一最终包的真机观察。源码/SDK回归不等于这些视觉项已经验收。

## 2026-09-17 真机安装回执

安装前重新发现唯一USB物理目标Connected，读取`bootevent.boot.completed=true`；HDC操作经共享服务租约串行执行。独立代理只读核对Core全部7个dirty输入及Harmony全部739个构建输入与上述收据/快照完全相同，Core build/package/Host staged原始NAPI一致，没有为安装重建或改代码。

官方inspect重新验签并确认既有debug应用的appId/appIdentifier与本轮包一致，`matching-identity-signed-update-candidate`，`preservesData=true`；随后官方install固定覆盖更新并启动，没有卸载、清数据、换签名或变更目标。日志为`physical-install-inspect.log`、`physical-install.log`。

原目标设备，回执仅本地保留；部署回执绑定本轮签名HAP SHA `4d730cb32fcce99f1ddc2d590b311007456fdf14c6fd928a0abefa7956b2b837`，`dataPolicy=preserve`、`install=PASS`、`launch=PASS`。未翻页、未更改设置、未抓屏或展开功能验收；安装/启动通过不关闭PH114–116的真机视觉与用户验收项。
