# VM翻页与控制动效：当前执行记录

当前候选 `20260911T051040Z-35f2f99a-5da12a49` 已签名复验并保数据安装，交互仍在继续。完整52项总账、修复说明、性能数值和证据边界统一见 [当前完整报告](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/evidence/2026-09-10-page-turn-physical-b1f20b88963d/CURRENT_ISSUES_AND_REPAIR_PLAN.md)；机器记录见 [execution-status.json](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/evidence/2026-09-10-page-turn-physical-b1f20b88963d/execution-status.json)。

本轮新增实测暴露了两项旧短用例没有覆盖的问题：90be滚动首次重进45px偏移（78b四距离复验在4px内），以及78b连续100页后倒退到被淘汰的前一章无响应（5da同点边界复验已通过，长跑重跑中）。滚动List首指占用遗漏已补修并通过生产代码回归，VM组合输入待补。所有旧记录均按候选保留。

90be七模块功能端点通过，朗读打开/收起UI最大任务7.157/12.494ms；目录、设置拖动仍有21.452/26.771ms超预算样本，含GC与guest未调度。仿真双向15.914/14.414ms只是UI任务样本。不得将这些值表述为触控到显示延迟、全程无长帧或最终用户验收。

当前VM：Mate 80 Pro，127.0.0.1:5555；未重启、重置、清数据或使用真机。[当前部署回执](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/.reader-artifacts/hap/20260911T051040Z-35f2f99a-5da12a49/deploy-vm-6460677a198b-20260911T051321Z.json)。[旧执行记录](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/evidence/2026-09-10-page-turn-vm-followup/VM_EXECUTION_HISTORY_THROUGH_20260911_0516.md)。

