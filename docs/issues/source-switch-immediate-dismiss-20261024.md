# 阅读页换源弹窗打开后立即消失

- 用户反馈：在阅读页触发换源时弹窗瞬间消失，再次打开也每次消失。
- 当前源码：Harmony main `6b1bd753` + 共享 dirty WIP；Core main `9131ddcf` + dirty WIP。已生成待安装 run `20261023T162151Z-6b1bd753-21f7c85e`，尚未安装；不能据此推定用户现场包身份。
- 本轮先审计 ReaderControlPanel → ReadingExperience → ReaderShell → Index.openSourceSwitch → SourceSwitchHost.open/openJourney/recoverIntent，以及关闭/退役回调。无设备抓取。
- 发现一个待复现路径：openJourney 恢复仍 pending 的旧换源事务，deliverRecovered 在当前书籍已为 target 时直接 hide + closed；pending journal 仍保留，下次打开可能重复。尚需用实际 owner 的持久化 fixture 复现，不能直接等同于真机根因。
- 尚未排除：遮罩触摸回调、导航退役、窗口状态变化导致的展示问题。

- 代码复现：真实 SourceSwitchHost/Gateway/IntentStore 配合受控 Core 和 AtomicFile 端口，已提交 pending 换源后将阅读身份移至 target，连续 3 次 open 均由 visible=true 变为 false、effect=closed；durable journal 仍为 confirmed，pending=1。不依赖遮罩点击、导航回调或窗口改变即可发生。
- 修复：openJourney 先仅恢复精确事务事实。若核对成功且当前已是未回滚事务的 target，继续 discover；跨书籍恢复仍交给原 deliverRecovered，未知/读回失败不越过安全边界。未清理 pending journal、未制造写入、未延时遮掩闪退。
- 必要验证：新增 `test-source-switch-host.mjs --case reopen-current-target`，覆盖 warm/cold owner、pending/finalized、连续重开、无额外 commit/rollback、精确查询失败仍保留弹窗和保护。复用生产 Host/Gateway/IntentStore 与 SDK 类型，仅受控 Core/文件端口，无嵌套测试、网络或设备操作。另外选择已有 cold-intent 与 cold-rollback，保护本次改动附近的跨书籍恢复分支；不运行整个父文件。
- 验证结果：新增 reopen-current-target、既有 cold-intent/cold-rollback 三个定向 case PASS，`git diff --check` PASS。测试首次使用固定 50 个 microtask 的 settle 时，terminal journal 的额外清理尚未到达候选状态；改为等待实际 owner 到达可见候选/失败终态，未放松断言。源码已修复，新的 HAP/安装/真机交互仍 OPEN。
- 打包尝试 `1792773277593-ed8ca464-f344-425f-82bd-d0935f07ef5f` 在并行新增设置页上编译失败：普通回调里的 CategorySection DSL 无法解析；ReaderMessagePreviewPage.enabled 与组件内置 enabled 方法冲突。仅将原内容提取 @Builder、改名 previewEnabled 并同步调用，保留业务行为；由实际 ArkTS 编译确认。用户已批准替换未安装 run `20261023T162151Z-6b1bd753-21f7c85e`，其他 9 个 run 通过 retention pins 保留。

- 合并本次两项修复后的 signed iteration run `20261023T163635Z-6b1bd753-64fb4e59` 构建/包字节/Native/指定证书与 debug Profile 验签 PASS。HAP SHA-256 `a710740a511698d5f82eb3bd822580722ec7a7654ea6520aea216aec6b38016e`。按用户许可替换未安装中间包，保留其 manifest/审批历史及另外 9 个包，总计 10 个。
- 设备层仍 OPEN：无线目标连接经一次目标会话重建及一次持有共享 HDC 租约的 Host 服务重启后，TCP 仍可达但 HDC 握手 Unknown；已停止挂起的本任务客户端并释放租约。等待用户重新开启无线调试提供新端口。未执行新包安装、卸载或清数据，真实交互/用户验收仍 OPEN。

## 2026-10-24 02:04 真机安装结果

- 当前main全部应用输入合包run `20261023T180007Z-6b1bd753-576a397b`；2035个输入与安装前当前源逐文件一致。Harmony 6b1bd753、Core 9131ddcf均如实保留dirty。signed HAP SHA-256 `a3de135a67e12a4c6f9c4afd96b3d714855100d783e7f8e2be5008ee02494dea`，指定minliny_HarmonyOS证书与debug Profile验签通过。
- 手机targetRef `2141c5a269b2`，规范inspect最终PASS；install -r成功，安装后包身份匹配核验通过，未卸载或清除数据。规范安装标记的resolution记录installOutcome=PASS。
- 自动启动失败：10106102，手机锁屏，开发者模式不允许自动解锁。没有关闭开发者模式或改手机权限；安装成功与启动失败分别记录，交互/用户验收仍OPEN。
- 当前pipeline在启动失败时提前抛错，未生成完整deploy回执；保留 `.reader-local/diagnostics/final-install.log` 和manifest同目录的 `resolved-retention-install-physical-2141c5a269b2-ed130db4-e903-4b9f-bf97-37260fd79d92.json.resolution.json`，不得伪称已有完整部署PASS回执。后续启动确认单独补证，不用重复安装掩盖失败。

- 用户解锁并明确要求启动后，经原共享HDC租约执行aa start成功（start ability successfully），pidof确认Reader进程28527。未重装、未重启HDC、未清数据。启动跟进记录：`.reader-artifacts/hap/20261023T180007Z-6b1bd753-576a397b/launch-followup-physical-2141c5a269b2.json`；此前锁屏失败保留，功能交互与用户验收仍OPEN。
