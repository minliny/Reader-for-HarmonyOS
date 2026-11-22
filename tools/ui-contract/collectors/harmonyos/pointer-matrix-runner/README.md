# 抓柄同指折返 Runner 源码

此目录是独立 Runner 应用的设备测试模块源码叠层。标准采集已接入独立 Runner 的验包、安装回执、资格和派发。现场签装、资格、派发和同指原生帧仍待验证。取证时先在同一已核窗口和同一公共本地阅读会话中记录 Search Full 抓柄中心，恢复 Search Quick，再记录当前抓柄的精确原生边界。Runner 只读取当前窗口和控件，执行时通过一次 `PointerMatrix.create(1, count)` 派发，沿向上轴到 80%，随后往回到 58% 抬起。SDK 的路径只有坐标和统一速度。收到同一个指针的两段 MOVE、原生进度折返和 Quick 提交都需要生产 App 的独立证据。

## 选择的离线校验

从维护 Host 根目录执行一项纯坐标与身份验证，外层测试时限 20 秒，入口只导入叠层的 `ReversalPlan.ts`。它核对公开固定输入能在同一抓柄轴上过中点后折返，拒绝候选身份变化、过期请求、变化后的 Quick 边界、脱轴和越界。SDK 调用、Runner 编译、签装和设备行为均不在此入口。

```sh
timeout 20s node --test --test-timeout=20000 --test-name-pattern '^one frozen Reader run plans one bounded up-then-down interior path$' tools/ui-contract/test/grabber-reversal-runner.test.mjs
```

叠层固定签名摘要与 `authority.json` 声明及本机证书链中的同一证书字节一致。

## 候选与参数

具备独立测试包的实际签名产物后，使用现有流水线的只读 `verify-runner`。独立 manifest 记录
`schema: reader-ui-contract-runner-artifact-manifest-v1`、明确授予的 `bundleName`、`expectedVersion`
的 `versionName/versionCode` 以及 `artifact` 的同目录文件名 `path`、`bytes`、`sha256`。
manifest 的 SHA-256 从独立交接取得。验签回执绑定实际 debug Profile、签名证书和 BMS 应用身份摘要。
产物验证与指定设备上的 Runner 安装和跨包采集分开记录。

```sh
node scripts/hap-pipeline.mjs verify-runner --manifest "$READER_RUNNER_MANIFEST" \
  --expected-manifest-sha256 "$READER_RUNNER_MANIFEST_SHA256"
```

获准使用当前 VM 目标并具备同一份验证产物时，使用 `install-runner` 一次性安装和读回身份。

```sh
node scripts/hap-pipeline.mjs install-runner --manifest "$READER_RUNNER_MANIFEST" \
  --expected-manifest-sha256 "$READER_RUNNER_MANIFEST_SHA256" \
  --target "$RUNNER_TARGET" --target-kind vm --vm-location "$RUNNER_VM_LOCATION" \
  --vm-log "$RUNNER_VM_LOG" --output-dir "$NEW_RUNNER_EVIDENCE_DIR"
```

签名核验依据固定清单和实际 HAP。同一目标租约内复核当前安装身份、HAP 字节及一次 `install -r` 的结果。
输出目录必须为新目录。成功写入 `runner-manifest.json`、`runner-verification.json` 及
`runner-deployment.json`。部署回执表示 Runner 安装和读回完成，启动字段为 `NOT_RUN`。
该入口只覆盖独立 Runner，正式 Reader 交付仍使用原有安装和存储准入入口。

现场取证前，目标探针提供受预检和会话租约约束的两条只读操作。
`uiContractRunnerInstalledIdentity` 携带独立 `bundleName`，仅保留可与部署回执比较的公开安装投影。
`uiContractRunnerClock` 只保留成功读到的 Unix 秒值。动作前按安装、时钟、Reader 同窗检查点的顺序
读取。专用探针会话最多调用一次固定 Runner 命令。

标准 `reading.control-grabber-reversal` 现场收集使用正常的 Reader 候选、隔离夹具和目标参数，
另传下面四项。Runner manifest 是与实际 HAP 同目录的原始清单。安装证据目录为
`install-runner` 的输出，部署摘要从本次确切安装记录独立取得。

```text
--runner-mode qualify
--runner-manifest <Runner HAP 同目录的 manifest>
--runner-install-evidence <独立安装输出目录>
--runner-deployment-sha256 <本次安装回执摘要>
```

资格模式到达标准 Search Quick 后执行 `dry`。请求使用已经校验的 Full／Quick 同窗标定。
原始 Runner 回执、动作后同一 Reader 实例及窗口、Reader 安装读回和干净退出都通过时，
发布 `runner-qualification.json` 和独立摘要。场景执行保持 `NOT_RUN`。
后续明确派发时使用 `--runner-mode dispatch`，并加
`--runner-qualification <已封存的 runner-qualification.json>` 和
`--runner-qualification-sha256 <独立资格摘要>`。采集器在取得租约前复算该资格，并核当前
Reader 候选、Runner 安装和目标一致。派发会话记录所用资格摘要。两个模式分别使用独立采集会话与新的输出目录。

保留已确认的生产 `io.reader.minliny` 候选及原始安装回执。将 `entry/src/ohosTest` 叠层仅放入另一个已获准的 debug Runner 包的构建输入。该包需要与实际 bundleName 匹配的 Profile，并使用规定的调试证书。DevEco 的测试入口选择 `assembleHap`、模块 `entry@ohosTest` 和 `isOhosTest=true`。生产和 Runner 分别核对签名产物摘要、包身份和安装读回。Runner 按自己的已安装版本、证书和更新时间自检。Reader 产品的真实性由外层部署回执核对，Runner 在本地核对前台窗口、包约束的控件读回和实测几何。

本机 API 23 映像确认 `-s readerReversal` 透传到 `AbilityDelegatorArgs.parameters['-s readerReversal']`。该映像的 `aa test` 启动和结束会终止测试命令所指定包的进程。外层须在调用前校验 `-b` 绑定获准的独立 Runner 包，Runner 入口也会拒绝 Reader 产品包。源码同时导出同一实现所用的 `runReaderGrabberReversal(request)`。

```text
aa test -b <RUNNER_BUNDLE> -m entry_test -s unittest ReaderGrabberReversalRunner -s readerReversal <REQUEST> -s timeout 20000
```

`REQUEST` 为一个逗号分隔参数，字段依次为 `runId,mode,versionName,versionCode,updateTime,expiresAtMs,baselineSha256,quickLeft,quickTop,quickRight,quickBottom,fullX,fullY,runnerBundle`。最后一项等于命令的 `RUNNER_BUNDLE`，必须与 `io.reader.minliny` 不同。使用独立 UUIDv4、Runner 的现场版本和安装时间、最长 120 秒的截止时刻，以及绑定同窗 Full／Quick 原始证据的 SHA-256。两个抓柄中心都来自原生实测，坐标单位为主屏物理像素，中心取整规则为向下取整。

SDK 声明将这些 API 限于 UITest 且要求串行调用。 `findWindow` 可按包名、焦点、活动和显示器查找，`On.inWindow(bundleName)` 自 API 10 起将控件查询限定在指定应用窗口。公开签名未确认当前设备是否允许独立测试包读取并操作 Reader 前台窗口。异常、前台变更、显示器不符或控件不可读会拒绝输入。

模式 `dry` 读取和验证前台状态与路径，输出 `DRY_READY`。模式 `dispatch` 最多调用 SDK 一次。外层以 `READER_GRABBER_REVERSAL_RECEIPT ` 识别独立回执，并使用本次 UUID、`runnerBundle`、输入基线指纹和准确产物核对唯一结果。回执在真实 stdout 上的行形态仍待验证。收到 `SDK_ACCEPTED` 后仍须读取同实例 App 的时序和逐帧观测。重复运行 ID 由外层密封采集拦截，Runner 进程内也拒绝重复调用。平台 Cancel 使用单独的条件取证。
