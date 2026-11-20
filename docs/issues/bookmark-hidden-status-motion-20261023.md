# 隐藏状态栏时书签与顶部信息的动效

- 来源：用户在真实阅读样式对比后反馈，隐藏顶部状态栏时下拉书签动效异常。
- 源码基线：Reader-for-HarmonyOS 主工作区 `main`，HEAD `6b1bd753` 加当前未提交修改。已有并行 WIP 保留；此记录不绑定任何已安装包。
- 代码定位：Stage 下拉整个页面，却无条件向书名/时钟传递反向位移；隐藏系统栏时这两者已归页面所有，导致它们和正文/书签分离。窗口设置还会在手势结束前发布新偏好，而重排延后，可能混用两种顶部几何。
- 修复：隐藏系统栏时顶部文字与页面共同位移；系统栏显示时保留原有遮罩与安全区域。窗口设置沿现有手势回退/结束交接延后发布，只保留最新待应用选择；原生窗口策略及失败恢复期间阻止新的翻页/书签运动，成功后重排并更新纹理版本。
- 几何结论：显示系统栏时书签必须放在不透明状态纸下方；隐藏时复用页面顶部信息行的 cutout/圆角布局。保留这两个物理约束下的位置分支，不删除安全间距，不把已测系统栏矩形清零。每个手势使用既有冻结布局，设置在交接点变更。
- 本次验证范围：`test-reader-bookmark-top-info.mjs` 的 geometry（SDK Stage/slot/Surface/Chrome 传参和状态纸几何）、transaction（生产手势和窗口设置交接/失败恢复）；这些 case 无嵌套测试入口。subscription 已在本轮早期通过；后续变更不触及其响应订阅，不重复执行。
- 验证边界：源码方法与 SDK Builder 探针不等同于原生像素或实时手势验收。HAP 构建、安装和真机交互本轮未执行。
- 验证中发现的阻塞：当前 dirty WIP 的失败页在普通箭头回调内直接声明 `Column`，SDK 全文件解析报 18 个诊断。只将既有动作区提取为 `@Builder readingFailureActions`，保留内容和动作后解析恢复。扩展组件末端探针时另发现 fixture 缺页脚空文本，补齐 fixture 后复验通过。
- 增补范围：窗口策略已修改，显式选择 `test-reader-window-chrome-order.mjs --case novel-setting-status,novel-setting-rollback`，验证真实 Coordinator/Gateway 接线的显隐偏好与失败恢复；无嵌套测试、网络或设备动作。相关旧 fixture 补充空闲手势阶段，不改变断言。
- 当前结果：`test-reader-bookmark-top-info.mjs --case geometry,transaction` PASS；120 组状态纸组合、两种顶部归属的实际 SDK 位移链、最新设置交接、原生 ACK/失败恢复、旧 ACK 与被其他设置取代后的锁释放均通过。窗口策略两个所选 case PASS。变更文件 `git diff --check` PASS。
- 现存边界：异步原生测量仍沿既有 metrics/reflow 路径处理；保留旧状态栏物理矩形是 cutout/圆角布局所需，不把缓存存在本身认定为错误。本轮未获得原生实时效果证据，用户可见效果尚未验收。

## 安装后反馈：下拉提示跟正文下移，位置偏低

- 用户确认触发为下拉书签；已安装 run `20261023T155303Z-6b1bd753-be3ba859`，HAP SHA-256 `cd6771df0b6153d901e603d72934237d76438ad7f3976068e1a8a49dafdf7332`。安装/启动成功不代表动效验收。
- 代码根因：`bookmarkHintY` 和 fits 条件使用视口坐标，但提示被迁入 PageChrome 后又继承 Stage 的下拉位移。提示被重复下移，可能进入正文。
- 测试缺口：分页提示已经位于 PageChrome，旧 probe 仍仅查 Host 提示节点，`if (hint)` 跳过了实际检查。现在必须查到所有已准入的提示，按最终视口坐标检查与正文边界。
- 本轮仅选择 geometry case：SDK 节点和真实 Stage 传参/位置验证，无嵌套测试、设备抓取或全量门禁。修复和验证进行中。
- 修复后：提示回到 Host 固定层；删除 PageChrome、Stage、ReadingSurface、纹理构建的提示 props 与重复渲染。书签图标仍归页面。隐藏系统栏时，提示只在顶部信息行下移让出足够空隙后显示，提示自身处于该行上方，不遮挡书名/时钟/图标。
- 新回归先在旧实现上失败：`large-scale hint only uses real blank/pulled space`；移回 Host 后进一步抓到移动图标与提示碰撞，补齐顶部行让位条件。geometry 现覆盖 200 组布局、视口位置、下拉/回弹固定 Y，以及提示必须真实显示和无页面内副本。
- 本次后续位置修复尚未重新打包或覆盖真机；上一个部署包仍包含用户反馈的缺陷。此前通过结果不能代替这次修复的设备验收。

## 2026-10-24 本次覆盖安装记录

- 用户明确授权解除旧 run `20261012T050556Z-493e6315-fdcbcc54` 的未完成安装保护。已在 run 锁内退役保护标记并保留审批记录、manifest 与历史证据；仅允许规范流水线删除该 run 的已验证 HAP，仍保持最多 10 次构建。
- 首次构建尝试 `1792771695015-3f412cf1-5863-4b5c-8997-87b5eab320ca` 在构建资源准入处失败；现场确认另一 Core 定向检查持有资源，未清理其锁或中断其进程。等待释放后继续。此失败未产生新 HAP，未改变真机应用。
- 资源释放后重试 `1792772000068-379eb201-304c-4088-936c-5857e2c699bf` 被 Native provenance 拒绝：Core build identity 与当前 worktree 不符。当前 Core 有并行简介规范化修改，不能复用旧 Native；按现有 `build-harmony-napi.sh` 重新生成，再经 `sync-native` 校验同步。仅执行产物生成及输入/字节身份核验，host probe、SDK smoke 与全量业务测试不附带执行。
- Native 首次生成完成编译和链接，但末端输入复验失败：构建期间 `crates/reader-runtime/src/remote.rs` 内容变化，Git identity 未变。该产物未同步、未打包、未安装。保留失败日志 `/tmp/reader-bookmark-hint-native-20261024.log`，按当前输入重试生成。
- Native 重试及 `sync-native` 通过。HAP 尝试 `1792772404720-3526646e-700d-40f6-b3d5-1cadf31ae850` 删除已授权旧包后，在 ArkTS 编译失败：LocalReadingExperience 的内容版本失败分支将 RemoteReadingGatewayError 直接传给 Error 参数触发 arkts-no-structural-typing。沿同文件现有调用方式增加 `as Error`，保留实例及错误分类；通过下一次实际编译验证，不附带全量测试。
- 新 signed iteration 构建 `20261023T162151Z-6b1bd753-21f7c85e` PASS；源码快照与当前输入一致，指定证书/debug Profile 验签通过。HAP SHA-256 `d37f3ce53aa91b3438e0b24044a0b9cf38fc4640902f66a9e5a78e75b43cd415`；Harmony `6b1bd753` dirty、Core `9131ddcf` dirty。目录现有 10 个 signed 构建包，旧包 HAP 已按批准退役。
- 安装前无线目标 `physical:70e766f54de6` 消失；重新连接后 TCP 可达但 HDC Unknown。未把本机 VM 当作替代安装目标，未向真机执行安装或清数据；用户回复继续，正在恢复精确目标连接。

- 合并本次两项修复后的 signed iteration run `20261023T163635Z-6b1bd753-64fb4e59` 构建/包字节/Native/指定证书与 debug Profile 验签 PASS。HAP SHA-256 `a710740a511698d5f82eb3bd822580722ec7a7654ea6520aea216aec6b38016e`。按用户许可替换未安装中间包，保留其 manifest/审批历史及另外 9 个包，总计 10 个。
- 设备层仍 OPEN：无线目标连接经一次目标会话重建及一次持有共享 HDC 租约的 Host 服务重启后，TCP 仍可达但 HDC 握手 Unknown；已停止挂起的本任务客户端并释放租约。等待用户重新开启无线调试提供新端口。未执行新包安装、卸载或清数据，真实交互/用户验收仍 OPEN。

## 2026-10-24 02:04 真机安装结果

- 当前main全部应用输入合包run `20261023T180007Z-6b1bd753-576a397b`；2035个输入与安装前当前源逐文件一致。Harmony 6b1bd753、Core 9131ddcf均如实保留dirty。signed HAP SHA-256 `a3de135a67e12a4c6f9c4afd96b3d714855100d783e7f8e2be5008ee02494dea`，指定minliny_HarmonyOS证书与debug Profile验签通过。
- 手机targetRef `2141c5a269b2`，规范inspect最终PASS；install -r成功，安装后包身份匹配核验通过，未卸载或清除数据。规范安装标记的resolution记录installOutcome=PASS。
- 自动启动失败：10106102，手机锁屏，开发者模式不允许自动解锁。没有关闭开发者模式或改手机权限；安装成功与启动失败分别记录，交互/用户验收仍OPEN。
- 当前pipeline在启动失败时提前抛错，未生成完整deploy回执；保留 `.reader-local/diagnostics/final-install.log` 和manifest同目录的 `resolved-retention-install-physical-2141c5a269b2-ed130db4-e903-4b9f-bf97-37260fd79d92.json.resolution.json`，不得伪称已有完整部署PASS回执。后续启动确认单独补证，不用重复安装掩盖失败。

- 用户解锁并明确要求启动后，经原共享HDC租约执行aa start成功（start ability successfully），pidof确认Reader进程28527。未重装、未重启HDC、未清数据。启动跟进记录：`.reader-artifacts/hap/20261023T180007Z-6b1bd753-576a397b/launch-followup-physical-2141c5a269b2.json`；此前锁屏失败保留，功能交互与用户验收仍OPEN。

## 2026-10-24 用户新要求对应的定向回归调整

用户要求“只隐藏系统状态栏，不移动顶部信息栏”。本轮生产修改由主任务持有，回归子任务不改 LRE/Core/其他生产文件。旧测试与新要求的冲突为：`geometry` 的 fixture 曾把 hide=false 定为 topInfoSuppressed，断言 visible 时不渲染信息栏时钟、hidden 时图标缩至系统栏高度，并强制物理 cutout 内狭窄横向通道必须出现左 fallback；如今两态使用同一个位于系统栏/cutout 下的信息栏。分页顶部信息始终随页；连续阅读仍保留原补偿语义。

本轮只选择以下两个入口，不运行其余 case、全量、构建或设备操作：

- `node tools/test-reader-bookmark-top-info.mjs --case geometry`：真实 SDK Builder、生产 readingLayout 与 Stage→slot→ReadingSurface→Chrome Prop 链；必要性为检查统一信息栏、字体/屏宽/cutout下的非重叠、完整书签尺寸、visible/hidden几何相同、分页跟页与固定Host提示，以及系统状态纸层仍在其准确范围。
- `node tools/test-reader-window-chrome-order.mjs --case novel-status-controls`：实际 SDK State/Watch 与 WindowCoordinator 的受控 native window；必要性为更新控制层关闭后信息栏始终可见的预期，同时保留状态栏偏好、导航/指示器偏好、控制层强制状态栏与退场/旧owner策略所有断言。

只调整旧事实 fixture 与对应预期，不删除实际非重叠、固定提示、系统状态带或原生窗口策略保护。结果随后追加。

### 本轮定向回归结果

- `geometry` 最终 PASS：200 组实际 LRE layout/SDK marker/status-paper 组合；新增 visible/hidden 下 contentTop、safeTop、信息栏高度、图标/标题/时钟位置与边界完全相等的成对断言；保留纸层避让、图标/时钟/标题非重叠、固定 Host 提示、分页 marker/clock 跟页及 Stage→slot→surface→Chrome Prop 转交。
- 执行中两处旧 fixture 先后失败并被修正：旧 `bookmarkFeedbackTopBoundary` 是包含信息栏底边的“提示下界”，不能再要求信息栏内图标在其下方，现精确要求图标在随页 safeTop 内且仍与真实系统纸层无交集；移除书签的旧 accessibility 文案没有“本页”，生产已明确“下拉/松手移除本页书签”，断言同步具体措辞。未修改生产几何或遮挡规则。
- `novel-status-controls` 最终 PASS：40 组 hide-status × cutout-extension × bottom-navigation × page-mode 组合，实际 SDK State/Watch 和 native window 序列保留全部原生栏策略及旧 owner 退役断言。初次执行在 inactive 时发现 fixture 未提供既有 `transientFeedback.reset` 端口；仅为此 case 补 reset 记录端口，并额外断言 inactive 恰好退役一次，未绕过实际 watcher。
- 仅上述两个 case 被执行，其他 case/full/Core/Native/HAP/设备均未触发。Node 的 experimental stripTypeScriptTypes 警告不影响两条准确 PASS 回执。
