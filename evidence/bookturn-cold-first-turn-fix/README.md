# 冷启动首轮翻页静默回滚 — 根因与修复（2026-08-29）

## 症状
进入阅读页后首次 native 翻页：动画完整播放至视觉完成，随后静默回退到旧页，页码计数不变。
之后所有翻页退化为 'none' 动画（瞬切），掩盖该 bug。

## 根因（三层叠加）
1. **换槽缺一次性守卫（主根因，本次修复）**：`bookturn_host.cpp` `ProcessSettlementFrame` 的
   `SettlementSwapShouldFire` 判定（τ≥脊点 + 隐藏 sheet 覆盖≈0）在换槽后**每一帧仍为真**，
   但缺少 `!settlementSwapped_` 守卫 → §7.3 tau_swap 每帧重复 `CommitSlots(NEXT)`：
   第 2 次旋转把**未上传的旧 PREVIOUS** 换进 CURRENT → base-only Draw 连续拒绝。
   VM 首轮必现（冷进入 PREVIOUS 槽未上传）；真机靠三槽全就绪侥幸掩盖（旋转后 CURRENT
   恰为就绪槽，但槽布局仍错乱）。
2. **VM swap 毛刺零容忍**（前次已修）：`eglSwapBuffers` 首几帧 fence 拒绝即 RENDER_FAILURE。
   修复 = 8 连续失败宽限（`kMaxConsecutiveDrawFailures`）。
3. **ghost 叠印**（前次已修）：band pass 的 `GL_SRC_ALPHA` 混合污染目标 alpha，
   合成器把 ArkUI 旧页透出。修复 = `glBlendFuncSeparate(..., GL_ZERO, GL_ONE)`。

## 诊断方法
- renderer 加 `DrawRefusal` 原因码（NONE/NO_CONTEXT/CURRENT_MISSING/TEXTURES_MISSING/SWAP_FAILED），
  随 RENDER_FAILURE detail 上报 → 首次定位 `detail=2 = CURRENT_MISSING`。
- host 加临时 BTHILOG（已剥离）→ 实锤序列（hilog-run7-bug-repro.log）：
  `settle start → swap fire/done ×1 → 【swap fire/done ×8 每帧重复】→ draw grace ×8 → draw FAIL refusal=2`

## 修复内容（最终 diff，4 文件）
- `bookturn_host.cpp`：换槽 `!settlementSwapped_` 守卫（核心一行）；8 帧宽限；
  RENDER_FAILURE 携带 `(int32_t)renderer_.LastDrawRefusal()`。
- `bookturn_host.h`：`consecutiveDrawFailures_` 成员。
- `bookturn_renderer.{h,cpp}`：DrawRefusal 枚举 + `lastRefusal_` 各拒绝点赋值；
  ghost 修复 `glBlendFuncSeparate`。

## VM 验证（run9-11 + final smoke，修复后）
- 冷启动首轮 NEXT：settle→swap 恰 1 次→endpoint→teardown(already=true 幂等)→纹理刷新，无失败事件。
- 帧序列（frames-run10-animation-grid.png）：帧 8 动画中间帧（纸页+阴影干净、零幽灵）→ 帧 10 落第 2/3 页稳定不回滚。
- PREVIOUS 反向：settle→endpoint→teardown + 3 次纹理上传，落第 1/9 页。
- 跨章翻页（章末→下章首页）提交+持久化通过。
- 干净构建（诊断剥离后）冷启动冒烟：首轮翻页 → 第 2/9 页 ✓。
- 本地测试 349/0 + 223/0 + 95/0。
- 诊断代码（ArkTS console.error ×2、BTHILOG、hilog 链接）已全部剥离；LocalReadingExperience.ets 与 HEAD 零 diff。

## 遗留观察项（非本 bug）
- 反向跨章落点=上一章第 1 页（页脚 1/9），落点语义未核（既有行为，未在本次范围）。
- 中间帧纸页为深色镜背板（mirror backface）观感——A/B 域（BOOKTURN_CONE_TAPER），挂账待用户裁定。
- 真机（非 VM）验证矩阵 §11：夜间主题/Tablet/低端机/取消手势/drag-follow 仍挂账。
