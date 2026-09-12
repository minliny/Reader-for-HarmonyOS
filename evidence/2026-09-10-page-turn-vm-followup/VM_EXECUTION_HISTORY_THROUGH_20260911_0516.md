# VM 修复后回归更新（2026-09-11）

此页上半部是实际执行后的新证据；下半部原始审计完整保留。**已修代码、包验证和特定 VM 样本通过，与全量视觉／性能验收分开。** 未使用真机，未新建、重启、清理或替换 VM。

## 修复和被测包

- 固定双槽、统一首指／事务、Native 最新样本及原子结束、提交前再抓、独立准备与索引、控制几何／列表缓存、动态高亮及滚动保存等原52项代码执行见[总账](../2026-09-10-page-turn-physical-b1f20b88963d/CURRENT_ISSUES_AND_REPAIR_PLAN.md)。
- 复验又发现并补修：页头文字反复测量；MOVE路径复杂页面@Prop复制；Native纹理时钟／胶囊失效遗漏；正常SurfaceLost禁用仿真；新建离屏邻页未绘制完就截图导致空底页。继续补修滚动恢复的布局时序和列表对齐偏移，以及当前页新revision截图的绘制就绪。
- 所有包均经规范pipeline构建、签名、verify、身份inspect及保数据install。当前最终候选和回执以[execution-status.json](../2026-09-10-page-turn-physical-b1f20b88963d/execution-status.json)的顶层runId为准；不能按目录日期或HAP名称选择包。
- 本轮180组Harmony门禁；Native solver235／motion538／renderer373／barrier159；ArkTS／Native无增量编译和签名通过。Harmony `35f2f99a…`、Core `6b2a9d87…`均dirty，iteration且acceptanceEligible=false。保留其他任务的首屏SDK修正和返回路由修正，未改Core业务。

当前最终候选：`20260910T191155Z-35f2f99a-b2b32102`；[manifest](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/.reader-artifacts/hap/20260910T191155Z-35f2f99a-b2b32102/manifest.json)；signed SHA-256 `a98e3a682ae3678a471c6e93b36d62911767bb279ff23c019c5b75e2cc59faa6`；[保数据部署回执](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/.reader-artifacts/hap/20260910T191155Z-35f2f99a-b2b32102/deploy-vm-6460677a198b-20260910T191350Z.json)。本轮逐文件核对504源文件／221控制文件全部一致。后续工作区变化不追溯修改已绑定的运行证据。

新增运行结论：`0c63426d` 保存滚动模式冷进入时停在分页外壳，已定位到模式分支和输入覆盖层未订阅plain array对应的revision；`b2b32102` 补齐订阅后冷进入、滚动、退出重进可运行。短滚恢复仍差10px，严格8px阈值FAIL，不能标R01全关闭。证据：`repair-validation-b2b32102/scroll-restore-result.json`。当前页get也已等待绘制再绑定新identity，分钟边界完整矩阵仍需复验。

## 有效样本

| 候选尾码／书籍 | 实际检查 | 结果和边界 |
|---|---|---|
| 4d55b276／EPUB | 控制栏打开、目录展开、收起trace | 最大UI帧任务20.169／17.546／12.842ms；不是七模块验收 |
| 4d55b276／EPUB | 滑动双向trace | 最大60.958／34.155ms；ReadingSurface Build／Destroy均0 |
| 48433b48／TXT | 滑动双向trace | 最大71.733／68.301ms；识别root／正文／chrome更新成本；不可与EPUB拼成严格A/B |
| 9abcb3e8／TXT | provider隔离后的滑动双向trace | 全窗口最大29.395／46.940ms，接触期间17.776／31.582ms；root最大更新3.523ms；正文零重挂载；反向与收尾长帧仍在 |
| 7b396cce／TXT | 仿真→滑动→覆盖→仿真→无动画 | 检查enabled、实际选中底色及正文双向往返通过；正常SurfaceLost重入修复有效 |
| 7b396cce／TXT | 平移100次交替 | 50次next＋50次previous，逐次正文和页码恢复通过；非单方向各100次／非rapid吞吐 |
| 7b396cce／TXT | 仿真两向中间帧 | 曲面确实运行，但底页空纸，视觉未通过；不能被终态正文正确掩盖 |
| 74ac9927／TXT | 离屏render-finished修复后同样两向中间帧 | 露出的底页正文恢复，真实Native帧验证通过；不是全帧／多主题／图片页验收 |
| 74ac9927／TXT | 滚动短滚→退出→重进 | 实际首行移动；原段Text顶部由-416px到-158px，发现恢复坐标偏差；修复后需要独立候选复测 |

每个repair-validation目录有原始命令日志、截图／布局、实际进程绑定的trace分析和候选身份。`7b396cce`结束后无关pilot资源发生变化，已记录逐文件差异；`74ac9927`的504源文件和221控制文件在18:31:53UTC检查全部一致。后续快照覆盖这些时点记录，不能说任何历史包永远等于当前工作区。

## 排除和仍开放的项目

- `9abcb3e8`的simulation-smoke／final-sim实际是覆盖，已明确撤回仿真和Native时钟验收。测试脚本现要求选项enabled且有实际选中底色；仅点击label不算模式切换成功。
- UITest drag有前置长按，正文样本触发了文字选择，不算跟手测试；落在桌面的截图、控制层尚未关闭的滑动也已排除。
- 精确QuietHold辅助程序在dry-run前加载依赖失败，未请求授权／未发送DOWN。旧同坐标MOVE的Hold不能代替完全无MOVE；用户“停住但仍按着才触发”的完整运行因果保持OPEN。
- 时间全部为App同步任务墙钟／guest调度，非显示帧长度或touch-to-photon。短样本、不同冷热状态和宿主争抢，不支持p95／p99或严格性能提升百分比。
- 控制栏七模块、中段平台／慢尾、深列表／异步／再抓、反向残余布局及GC；P08原第6/11页44%同锚点；真实显示fence；动态高亮像素；图片／夜间／旋转／失败；rapid全链、总内存／上传／空闲预算；单方向各100次和10次再抓均保留。
- 74ac一分钟边界帧存在source02:26／destination02:27，时钟过期虽不再无限保持，跨边界一致性仍需新revision当前页截图等待绘制后复测。
- 120Hz、物理触控、低端机与温升功耗留真机层；本任务遵守仅VM的授权边界。

## 最终复核与释放

`b2b32102`最终Native next／previous截图确认两页正文均已绘制，底页空白修复保持；分钟边界仍见source03:19／destination03:20，时钟一致性未关闭。滚动冷进入和普通退出恢复可运行，位置差10px仍FAIL严格8px标准。恢复“滑动”设置后再做4次往返通过。原7b100次交替证据仍绑定原包，不重命名为最终包100次。

本任务于2026-09-11 03:24:39北京时间正常quit，03:24:40确认锁已不存在；没有抢锁／删锁／重启／清理VM。最终测试书10%、第2/10页、控制栏关闭。最终源码504／控制文件221全部匹配包快照。[释放记录](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/evidence/2026-09-10-page-turn-vm-followup/repair-validation-b2b32102/VM_RELEASE.json)，[末次身份核对](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/evidence/2026-09-10-page-turn-vm-followup/repair-validation-b2b32102/final-source-identity.json)。任何后续设备状态变化须重新核查。

