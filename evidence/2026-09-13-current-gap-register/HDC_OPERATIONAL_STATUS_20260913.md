# HDC 单所有者执行记录

日期：2026-09-13

## 已执行

- 将 lease 锁粒度从单目标提升为共享 HDC 服务键，默认 `127.0.0.1:8710`；`::ffff:` 映射地址规范化到同一键，目标仍写入 owner/event 记录。
- `hap-pipeline.mjs`、设备探针和 fast-capture 均通过同一 wrapper；fast-capture 默认串行，显式并发最多 4 路。
- 新增跨目标同服务并发回归；`test-reader-hdc-lease.mjs` 通过。
- 设备探针回归通过；Harmony 全量合同回归 198 项通过。
- 重新生成 iteration HAP：manifest `20260912T165214Z-50cad401-ea3dd1c8`，签名 HAP SHA-256 `284ed566b3a791d6294c5971f5904cae14aa3495709b9afe766504f82cca3206`。

## 外部所有者状态

- 初始记录时 DevEco Studio 保持到 `127.0.0.1:8710` 的已建立连接；项目 wrapper 无法拦截 DevEco 或工作区外的原始 `hdc`。
- 已通过 DevEco 设备菜单确认当前设备项和“无 OpenHarmony 设备”项；前者仍被选中，后者为不可用项，未能从 UI 断开外部会话。
- 关闭整个 DevEco 会丢失未保存工程状态，未执行强制退出；因此没有破坏共享 VM、设备或用户数据。

## 后续状态

- 用户关闭 DevEco 后，复查确认 8710 无已建立客户端；同一 Mate 80 Pro 实例曾因缺少 DevEco heartbeat 自动退出，未创建新实例、未清理 userdata。
- 已重新打开 DevEco 的同一工程，通过设备管理器启动原 Mate 80 Pro。HDC 服务恢复后，`127.0.0.1:5555` 为 `Connected`，`bootevent.boot.completed=true`。
- 固定 manifest inspect 通过；同一签名 HAP 保数据安装/启动通过，回执：`.reader-artifacts/hap/20260912T165214Z-50cad401-ea3dd1c8/deploy-vm-6460677a198b-20260912T175539Z.json`。
- 设备探针已通过共享 lease 获取并安全释放；探针只记录 ready/closed，boot 与前台判断由独立 HDC 只读证据完成。

## 判定

项目内并发竞争已永久收敛到单一共享服务 lease；外部 DevEco/raw-hdc 客户端仍在脚本边界之外，禁止并发下发设备命令。当前 HDC 传输与 VM 交付链路已恢复；视觉和用户验收保持 OPEN，不能由 HDC/安装通过替代。
