# 书架筛选默认收起

用户要求书架筛选默认关闭，随后明确要求不更新VM，HAP构建完成后安装真机。

原因及修改：`BookshelfViewState.filterExpanded`原先明确默认为true，`BookshelfPage.aboutToAppear`从该状态恢复，覆盖页面本身的false。现在仅将初始值改为false并修正注释。手动展开/收起、返回时保留用户当次选择、筛选条件及活动条件提示均沿用原逻辑，没有清除任何用户数据。

验证：现有`test-bookshelf-filter-responsibilities`、`test-bookshelf-viewport-return`定向PASS，未新增镜像实现的测试。规范命令`READER_CONTRACT_TEST_WORKERS=2 node scripts/hap-pipeline.mjs build --class iteration --signing local`退出0：完整703/703 PASS、omitted0、529 integration完整分类；合同阶段723392ms。全工程ArkTS、非增量构建、必需资源、内嵌书源、签名校验PASS；保留既有SDK WARN。独立`hap-pipeline.mjs verify --manifest`退出0、PASS。

- run：`20261019T054723Z-5a01ec1c-b29ee351`。
- manifest：`.reader-artifacts/hap/20261019T054723Z-5a01ec1c-b29ee351/manifest.json`。
- signed HAP：同目录`entry-default-signed.hap`，SHA256 `4862106e249cd06edad7b660630782f9c22ad12757d11104582ee67789ef823d`。
- signature verified true，debug Profile，包名`io.reader.minliny`，指定minliny_HarmonyOS证书SHA256 `3A563778E5BF17CD3EAD0218E13B4A5030DE3F5D7D4E21E0336D8EB37B676DC4`。
- Harmony `5a01ec1cdbd5ec864046e1b9202963ead23a513a`、Core `b52365329f1312c7bb80605c8a74eecaf8f4bc44`，均dirty。既有其他改动保留，不回滚或提交他人工作。本轮只改默认状态及注释，没有修改Core。
- 构建日志：`/tmp/reader-shelf-filter-default-pipeline-20261019.log`，正式合同凭证与日志封存于该run；离线verify及连接状态在`.reader-artifacts/shelf-filter-default-20261019/`。

## 真机交付状态

构建过程中现场发现一台USB Connected真机；构建完成准备交付时同一目标变为USB Offline，再次只读发现仍Offline。已通过交互提示请求用户重新连接、解锁并确认调试授权。没有在离线状态查询应用、尝试安装或重启HDC/设备，没有替换成VM。

当时`physicalInstall: OPEN`、`launch: OPEN`，没有成功部署回执；未在离线状态尝试安装。用户随后明确回复已连接。重新发现同一USB Connected目标后，规范physical inspect确认boot/SceneBoard就绪、签名与现有应用身份匹配，保数据更新允许；沿用已经完成的同一HAP，没有重建或重跑全量检查。

当前`physicalInstall: PASS`、`launch: PASS`、`dataPolicy: preserve`。部署回执：`.reader-artifacts/hap/20261019T054723Z-5a01ec1c-b29ee351/deploy-physical-b1f20b88963d-20261019T105931Z.json`，完成于北京时间2026-10-19 18:59:31.672；targetRef `b1f20b88963d`。无卸载、清数据、换签名、重启HDC或设备。原VM未更新。原生界面/交互与用户验收仍OPEN，不以安装启动成功代替。

## 耗时复核

hap-attempt起止为北京时间13:34:34.636→13:47:33.418，共12分58.782秒。其中完整合同wrapper为12分03.392秒（实际contract stage 12分00.144秒），实际Hvigor编译/打包/签名仅37.206秒（13:46:44.190→13:47:21.404）；其他约18.184秒为依赖和产物核验等。manifest自身约37.777秒没有包含前面的完整合同，不能以此冒充整轮构建耗时。

构建结束后发现USB Offline，未执行安装，直至用户回复连接恢复后才续装。构建执行时间、离线等待、实际安装与用户指令到安装的总跨度应分别记录；原始用户消息时间不在构建日志字段中，不用构建耗时冒充用户等待总时长。

HDC lease中该任务首次安装连接检查（discovery/list targets）为北京时间13:36:04.987，至安装完成18:59:31.672相隔5小时23分26.685秒；它是“首次连接检查→安装完成”的精确区间，不是精确用户消息时间。产物就绪13:47:33.418→安装完成另隔5小时11分58.254秒，属于产物完成后的未安装等待，不能记入构建耗时。

这是iteration产物，Core完整development gate、线上书源网络、此次VM交互、真机功能交互与用户验收均未运行；包构建/验签不能代替安装或原生视觉验收。
