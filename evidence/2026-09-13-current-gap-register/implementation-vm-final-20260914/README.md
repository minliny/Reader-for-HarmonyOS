# 第三包 VM 证据与人工审视交接（2026-09-14）

这是已结束的第三包证据快照，当前任务状态只见根 [DEVELOPMENT_BACKLOG §11](../../../../DEVELOPMENT_BACKLOG.md)。用户最新要求优先安装真机后人工审视；root 已停止本轮 VM，后续物理安装及用户结论须另有实际回执，**本目录不代表用户验收通过**。

## 产物与结束状态

- 安装源码：clean Harmony `9509d4feb410ce559d67b77785e2248e88485f4e`；Core `952704bd57518af530a948dfd3408a119c20e276`。
- [manifest](../../../.reader-artifacts/hap/20260913T160039Z-9509d4fe-25529e1f/manifest.json)：`20260913T160039Z-9509d4fe-25529e1f`；signed SHA256 `b9ef64ece51c02c865ca1740fee52ca7efebe162495fb784fa000fae1aacf2fd`。
- [VM部署回执](../../../.reader-artifacts/hap/20260913T160039Z-9509d4fe-25529e1f/deploy-vm-6460677a198b-20260913T160848Z.json)：00:08:48.712 CST，保数据install/launch PASS；本目录截图前缀 `reader-control-r9509-1789315814956`。
- [probe日志](reader-control-probe-1789315822668-92b6fe38-a316-42c9-a02d-fe13bc42b8c9.jsonl) 共350条，SHA256 `94aa648709ae783623ddc6a7b52c38a00fd9bf69643b7f27758d4f5610a983f1`。93份capture（60 JSON、33 PNG）逐一核对长度/hash、JSON解析及PNG CRC/IEND，无尾部额外数据。文件完整性只证明证据可用。
- 日志于 `2026-09-13T16:48:49.011Z`（00:48:49 CST）正常`closed / quit-or-eof`；root确认probe5247退出及释放占用。最后已抓取 `mode-settings-full`，停在FullSettings，仿真未改；App Day/Reader Day已恢复、cutout=false、Auto/TTS停止，四书/list保留。不是回到书架截图后结束；不能误写最终路由。

## 已有观察与新补修的边界

[五模块收起独立观察](reader-third-vm-observed.md)和[逐文件/祖先/回执JSON](reader-third-vm-observed.json)为临时报告的原字节归档。Auto/Settings/Appearance/TTS/Directory五项真实按钮收起回同模块Quick，正文hash/3/4页未变；该独立报告只覆盖五项，不擅自扩大为七项或连续动效验收。目录列表往返另发现锚漂移并已代码定位。其它已落盘搜索/替换、Night、picker及导入结果文件保留各自真实范围，不能仅凭文件名或到达页面记全流程通过。

| 第三包之后的补修 | 当前证据层 | 入包/设备边界 |
|---|---|---|
| 目录尾部Quick→Full→Quick从146–150漂到140–143 | 实际生产方法+150行/VM高度模型修前4659→4438.171，修后8场景通过；原合法Full尾部钳制保留，仅未对齐语义锚延后释放，用户滚动仍接管；1主测试+3关联文件通过 | 只改DirectoryContent及既有测试；晚于9509，尚无补修包VM或人工结果 |
| 主题文字 | [独立审计与本地修复](reader-third-night-icon-observation.md)：夜间“完整目录”文字误用实体填充色；新增应用强调文字角色 `TOK_PRIMARY_TEXT`，14文件41处前景调用复用既定日夜色，21个实际SDK状态和15组关联检查通过 | 第三包已有动态SVG像素观察与此文字补修分别记账；文字修补晚于9509，尚无补修包VM或人工结果 |
| U14搜索历史首次只有“1条更多”、chip为空且区域居中 | [代码审计与红绿结果](vm-search-history-observation.md)：零宽测量依赖历史内容形成启动闭环，Scroll默认居中；测量移到常驻外Column并明确顶对齐，正式5场景和4关联检查通过 | 晚于9509；当前search-page是修前证据，新包首次进入/开合像素未复验 |
| refresh几何 | [Figma与源码审计](reader-import-refresh-source-audit-20260914.md)：设计本来是单路径C形弧，不存在丢失箭头；当前18×18渲染将含旋转外接范围的24×24导出资源再次缩为0.75，笔画及可见范围偏小。修正方向为23.754绘制尺寸置于原18槽位；已归档[修前生产Builder探针](reader-import-refresh-builder-before.json) | 修后实际SDK Day/Night/Day的18槽、23.754绘制及1.5笔画已通过，并有两组关联检查；补修已提交1921b84d，新的包/设备结果另记，不算入9509 |

目录锚原始红绿与关联日志已原字节转存：

- [修前失败](reader-directory-tail-anchor-before.log) / [修后通过](reader-directory-tail-anchor-after.log)
- [Header SDK](reader-directory-tail-header-related.log)、[Host session](reader-directory-tail-host-related.log)、[Morph scroll](reader-directory-tail-morph-related.log)

主题文字与refresh的同前缀原始审计、生产Builder红绿（已存在的部分）、像素统计和设计导出一并原字节转存，[归档校验清单](supplemental-evidence-archive.json)记录每份字节数与SHA256。主题角色[修前](reader-third-night-icon-primary-builder-before.json)/[修后](reader-third-night-icon-primary-builder-after.json)及[15组检查](reader-third-night-icon-primary-tests.json)可独立复核；refresh已补齐实际[修后Builder回执](reader-import-refresh-builder-after.json)，它是代码/本地层，不替代新包设备效果。

报告JSON中的`/private/tmp`是原始执行位置；本目录同名文件为稳定副本，字节/hash一致。没有为归档改写或截断原probe；没有执行Git或HDC。

## 继续保留的未覆盖项

**五种翻页触控未执行**：只到FullSettings准备，不能把菜单中有覆盖/滑动/仿真/滚动/无动画写成五模式通过，停指仍按住、双向跟手、触控至屏幕、亮度MOVE及Cancel同样不由页面到达证明。四入口3500ms连续动效/中断、短屏旋转、真实远程缓存TOC/原失败样本、导入多文件超高/混合失败/慢任务、全主题合成、旧52ID性能和长时矩阵，以及物理音频/亮度/GPU/120Hz/温升功耗和用户验收仍按原总账开放。

四项补修已完成并按内容提交：目录a0374fcc、搜索c398cafe、主题05c39cf7（共享定义aaaa0c53）、导入1921b84d。接下来按标准流水线生成可核对的新包，再完成用户要求的保数据真机安装与人工审视。本次人工审视接管不会抹掉代码/本地/VM/硬件之间的证据边界，也不自动关闭未覆盖项。
