> 历史快照说明（2026-09-13复核）：本文保留当时日志/判断，不维护当前待办。当前实施合同见 [READER_REPAIR_SPEC](../../docs/READER_REPAIR_SPEC.md)，实时状态见工作区 DEVELOPMENT_BACKLOG §11。下文旧“CODE FIXED/未实现/需决定”不自动继承；尤其胶囊时值、Night不存在/强改不透明、More=书签/整理=CRUD、201固定按钮宽及整组翻页缺实现已被当前源码/Figma/原始用户决定纠正。

# 当前版本全量闭环验收账本

日期：2026-09-13

## 已闭环

- Core 本地混合语料：Downloads 中去重后 13 本 TXT/EPUB/MOBI 全部解析成功，单本均小于 10 秒；证据：`evidence/local-book-oss-implementation/downloads-novel-batch-2026-09-12.json`。
- Harmony 本地合同回归：198 项通过，最终日志见 `harmony-check-local-20260913-final.log`。
- 控制栏代码侧补齐：快捷自动翻页移除返回入口，补齐快捷速度 ±、播放卡背景/边框/圆角；书架列表补齐作者、最新章节、真实来源/阅读状态四层投影并提高列表行高。相关静态回归均通过。
- 当前格式准入：TXT、EPUB、MOBI、AZW3 进入 L0；UMD 仍保留 deferred-partial，避免把无可用解析链的格式误报为可读。
- 当前 HAP：iteration 构建成功；manifest `../.reader-artifacts/hap/20260912T165214Z-50cad401-ea3dd1c8/manifest.json`，签名 HAP SHA-256 `284ed566b3a791d6294c5971f5904cae14aa3495709b9afe766504f82cca3206`。

## 尚未闭环

- 运行视觉验收：OPEN。当前 HDC 目标列表曾可见 `127.0.0.1:5555`，但对该目标执行 `shell param get bootevent.boot.completed` 返回 `Connect server failed`；重启后服务又进入无输出等待，尚未取得启动完成、SceneBoard 稳定、当前 HAP 保数据安装回执和截图/布局树。
- 物理设备与用户验收：OPEN。旧版本截图不能覆盖当前 HAP；DevEco Run 被项目 HAP 门禁按设计拒绝，必须通过 immutable HAP pipeline 后再部署。
- acceptance build：OPEN。Core 与 Harmony 工作树存在用户/并行修改，pipeline 明确禁止在 dirty worktree 生成 acceptance artifact；本轮只产生 iteration artifact。

## 判定

代码和本地回归层 PASS，产物构建层 PASS（iteration），运行视觉、设备和用户验收层 OPEN。不得把旧截图、静态结构测试或 DevEco 构建失败信息写成当前视觉通过。

## 下一步最小闭环

恢复项目批准的 HDC 服务后，重新确认 exact target、`bootevent.boot.completed=true`、Guest OS Boot Completed 日志和 SceneBoard 稳定；使用上述 manifest 安装并保留数据，导入 13 本语料，分别抽查 TXT、EPUB（含图片/BOM/大资源）、MOBI6 与 KF8/AZW3 的书架元数据、章节边界、正文、图片和翻页截图，再记录 VM、真机和用户验收分层结果。

### HDC 复发审计

初始审计显示 HDC server `127.0.0.1:8710` 由 PID 60559 监听且 DevEco 进程 PID 68292 保持连接；用户关闭 DevEco 后，复查显示服务 PID 71437 仍监听但无客户端，lease-wrapped 目标探测仍返回 `Connect server failed`。当前已排除 DevEco 长连接，剩余问题是 HDC 服务/端点自身未恢复，详见 `hdc-contention-20260913.json`。
