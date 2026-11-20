# 书源管理与最新开书动效整合

用户明确要求新包合并独立书源管理实现，并包含主线最新开书动效。独立源为 `.reader-isolated/source-management-ui-20261030` 的 Host/Core，HEAD 分别为 fce869a1/80d614e 加复制时 dirty 输入；原候选 run 为 `20261030T141825Z-fce869a1-19b6a8b1`。它保留历史判定，不能改称包含最新动效。

## 合并边界

- 使用原 `input-baseline` patch 重建基线作三方合并，Host 已合并 24 文件、新增 16 文件，无冲突；Core 已合并 38 个生产输入。前像、逐文件 SHA 和回执保存于私有 `physical-bookshelf-motion-20261030/source-ui-integration/`。
- 保留当前 MotionSpec、固定布局/图片补偿/独立底纸的 Transition、同时间轴真反向，以及停止态安装与 sameBoot witness 修复。未把独立工作区的全部 dirty 文件视为独立开发内容。
- 不复制独立 Native/SDK、源集合、大批门禁索引或共享治理投影。现有主线 SourceSupply 未知字段保护保持原字节。独立 Native 6137 不能用于加入兼容修复后的新输入，后续须重新生成配套 Native/inspector/SDK。

## 已发现的兼容问题与实施方向

独立候选把 SQLite 44/45/46/47 显式迁移到 48/49/50/51，Host 启动会自动提交计划；其新增删除及 sync epoch trigger 也会被原主线准入拒绝。即便保留游标，只加表和 trigger 仍不兼容。另旧 snapshot18/config2 缺少分组域时被默认成空 catalog，无条件 restore 有丢失分组风险。这些是代码审计结果，不把独立包的编译成功当兼容通过。

本次保留 SQLite 44–47 和 data generation1：分组使用无 trigger、无跨域 FK 的独立追加表；缺表查询只读稳定派生，实际分组写入才在事务内初始化，并真实复验/重绑定 DDL cookie。旧实现普通源 CRUD 不得删除独立 catalog；失效成员不能锁死所有分组操作，未经真实操作不清理原事实。

保留独立已明确引入的完整分组备份格式 snapshot19/config3；这些是显式文件格式版本，不能声称旧18/2读取器可读19/3，也不能把新字段伪装塞进旧严格格式。新实现继续读取旧18/2，并保留域存在性：未携带分组域沿用当前 catalog，携带的空域才表示明确恢复空分组；新19/3缺域及旧18/2带新域须拒绝。数据库互操作与备份格式支持分别验证、记账。

## 当前验证范围

必要的新验证为真实44/46/47的缺表只读、首次分组写入/冷开、旧维护实现普通CRUD保留catalog、CAS拒绝原子性、旧18/2不清域、新19/3完整/空/缺席及认证恢复。实施者须先列准确用例和嵌套入口，不跑全量。独立未受影响的 Host 模型证据仅在逐字节核对后记 REUSED；整合编译、签包、安装和设备行为均另行取得。

动效的 transform、timeline 和指定 header case 已通过；物理初始包安装/Native身份已通过但用户明确拒绝卡顿观感。旧 trace 仅进入详情，不作封面 FPS 基线。仅动效修订包 `20261030T142332Z-fce869a1-286f585c` 已构建但未安装（紧前启动身份预检 STOP，未写包），现被整合目标替代。整合包已覆盖原 a3e0 候选，未清数据、卸载或改变 VM。

完成状态：**整合 Native、签名 HAP 和2026-10-31保数据重新安装 PASS；按用户本次范围未启动应用，未截图、录屏或读取界面。Native运行身份、交互、流畅度与用户验收未验证，不再等待前台取证。**

整合包实际已构建：run20261030T150815Z-fce869a1-5565d840，signed SHA6987f484cb7ba04dfdfdecaddb2ab3b7e8b6caf366eda5af3c15fc90f4c9d94f（214675969 bytes），strip Native834b756a…/Core4a52，指定证书验签通过。11个相关motion/SourceUI源码SHA与包的source-snapshot一致。Native Rust release首次完成后因CMake图仍绑定独立路径停止，原图保留；同锁重配复用已编Rust后PASS。匹配inspector018043b…及完整producer只读archive已保存，无全量/业务smoke。

真机canonical覆盖安装实际PASS：该run protection-resolution的installOutcome=PASS，源码顺序已完成实际install成功回执、post-install签名复核与candidate binding后才进入启动。启动返回系统10106102（锁屏，开发模式不能自动解锁），所以无完整launch receipt，不把包安装成功当Native/前台交互通过。已请求用户解锁并保持Reader书架前台；等待时不重装、不清数据或改设备模式。独立WMS观察也已证明此前采屏时焦点为其它App，后续UI输入必须先验证focus Window的PID等于本次Reader PID，不只看AX树。

新增审计边界：旧878c直接source.supply复开保catalog已通过，但它不经过rules owner。真实旧rules路径已复现：receipt解码白名单不认识新group方法，query及后续source.update均以rules_mutation.corrupt_head拒绝，原head/source/catalog未被修改。不能将source.supply结果外推为所有旧UI写入通过。

对应旧维护补丁只把已持久化的未知方法回执作为不透明历史读取，继续严格核验原binding及ACK hash；新请求仍限原方法白名单，未知方法不得执行，sequence/CAS不变。真实旧生产Runtime的Apple主机维护构建已通过query、已知后继写入及准确重放，未知执行拒绝和binding/ACK损坏负例也通过。维护源码指纹6b4b96ac…，原878c仍为失败负例；旧ARM Native、旧HAP签名/安装未运行，旧包原字节未修复。准确证据与补丁见[旧维护记录](../maintenance/storage-compatibility/old-878c-rules-opaque-receipt.json)。未决的新方法Host intent仍需支持该方法的Host/Core恢复；没有把静态成功清理路径当成设备磁盘journal已观察。当前新Core本身已支持分组方法，现有整合HAP源码保持冻结。

## 2026-10-31 真机操作授权边界

用户对未单独取得明确授权的真机截图提出异议后，真机操作及截图采集已停止，已有截图不再读取或使用。用户随后明确要求“现在安装到真机”，本次仅重新授权指定真机的保数据安装；不包含截图、录屏、AX/界面采集、启动应用或交互验证。原等待解锁后继续采屏/动效测试的安排失效，不得据此恢复。

复用整合 run `20261030T150815Z-fce869a1-5565d840`，使用 canonical `install --no-launch`。本机原HDC监听仍在但设备socket为SYN_SENT；同目标直接TCP 95ms可达，一次10秒tconn超时。确认无其它客户端/活动租约后，保留诊断并通过租约入口一次受控恢复；新服务准确目标Connected，socket为en0直连ESTABLISHED，未改变VM。安装所需的停止态数据备份、兼容性和签名检查独立执行，不触发回归、截图或业务Runtime。准确回执存放私有 `install-only-20261031/`，实际安装结果另记。

2026-10-31 本轮仅安装的实际结果：`install --no-launch` 在紧前boot复核报 `target boot changed during storage admission`，写包前停止；上一轮安装PASS保留历史判定，不能作为本次已完成回执。新的一致数据库备份仍为44/generation1。另一次仅系统参数的有界两批readiness观察复现推算bootStart跨27秒漂移16/17秒，SceneBoard/6项milestones未变，host/guest/monotonic连续；原失败批次current未留存，不外推其准确失败分支。SceneBoard stat可读但不是boot UUID；内核btime返回0，无效。未放宽阈值、未修改生产控制器，也未实施新的uptime数学证明。已请求用户保持手机解锁亮屏后再做准确安装检查；该输入只用于安装，不恢复任何截图/启动/交互授权。

2026-10-31 用户再次明确“重新安装”后，直接执行原canonical `install --no-launch`，未改控制器或放宽检查。该次保护检查通过后实际覆盖安装PASS，回执 `deploy-physical-929ff1c0644b-20261030T162944Z.json`，dataPolicy=preserve、launch=NOT_RUN；HAP SHA仍6987f484…。本次只安装，不截图/录屏/读取界面，不启动业务Runtime；原失败记录保留，不再请求用户配合动效取证。
