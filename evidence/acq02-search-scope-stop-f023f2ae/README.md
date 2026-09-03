# ACQ-02 搜索范围筛选与停止控件 — VM 验收证据

- 日期: 2026-08-30
- 分支: `feat/acq02-search-scope-stop`（worktree /tmp/ledger-b2-fixes）
- HAP: `entry/build/default/outputs/default/entry-default-signed.hap`
  SHA-256 `f023f2ae33ca20f186b15ef79a5a3ff7fa34cafeb4404bac83b70053090d2557`
- 安装: `hdc -t 127.0.0.1:5555 install -r`（保留数据，签名一致），bundle `io.reader.harmonyos`
- VM 锁: `/private/tmp/reader-vm-locks/reader-harmony-vm-127.0.0.1-5555.lock`（本会话持有并已释放见下）

## 宿主门禁

- `tools/test-search-orchestrator.mjs` — PASS（21 测试，新增 16-21：停止于 loading/流式中、范围交集、stale 范围空态、settled 面停止 no-op、scoped retry 保留 lastScope）
- `tools/test-legado-product-logic.mjs` — PASS（P0-DEAD-CONTROL-CLEANUP 的 doesNotMatch(sourceChip) 已被 ACQ-02 正向接线断言取代：搜索范围/toggleScopeSource/onSearch(keyword, scope)/onStop/Index.stopSearch）
- `tools/test-search-gateway.mjs`、`tools/test-error-message-conformance.mjs`（88 源）— PASS

## VM 验收（布局树为准，坐标 127.0.0.1:5555）

| 观测 | 证据文件 | 结果 |
| --- | --- | --- |
| A: 全范围搜索 剑来 → 约 4s 点停止 pill → 结果保留 + 头部标记 + pill 回落 搜索 | `acq02-t2-live.json`（进行中）、`acq02-t2-stopped.json` | `· 已停止,已搜索 11/63 个书源` 渲染；pill=搜索；hilog `Search sweep stopped by user: 剑来` @07:21:17.720 |
| B: 重进 → 展开范围墙（`acq02-t3-wall.json` chip 坐标）→ 点排除 猫眼看书 → 标签 `已选 62 个书源`（`acq02-t3-sel.json`）→ 搜索 剑来 → 停止 | `acq02-t3-stopped.json` | `· 已停止,已搜索 3/62 个书源`；M 63→62 差一即范围收窄生效；hilog 第二条停止行 @07:22:25.434 |
| C: 乱码关键词 zzzqqx 中途停止 → 停止态空态文案 | `acq02-t4-empty.json` + 截图 `acq02-t4-empty.jpeg` | `已搜索 4 个书源后停止,未找到「zzzqqx」的相关结果` |
| 进行中 pill=停止（spinner+停止） | `acq02-t2-live.json` | pill 三态（spinner停止/停止/搜索）实机成立 |

- `acq02-hilog-full.txt`: `grep -c "sweep stopped"` = 3（07:12 旧包一次 + 07:21/07:22 新包两次）。

## 渲染修复记录

首轮 VM 发现停止标记不渲染（`/tmp/acq02stop.jpeg` 旧包证据，未入库）：标记门控在 @Builder **参数** 上，最小更新重渲染不追踪；改为在 builder 内直读 `this.presentation.stopped === true`（与已被证实响应的搜索/停止 pill 同模式），空态文案改走 `isStoppedEmpty()` 私有方法（避免 @Builder 内 const 的编译风险）。重建后三项 VM 观测全过。

## 语义

- scope = sourceId 子集；undefined=全部；orchestrator 与 (enabled && named) 取交集；交集为空的提交被 UI 在 pill 上降不透明度禁点。
- stop() 复用 work 代际取消原语；loading → honest empty{stopped, searchedSourceCount=已完成数}；流式中 → results{searching:false, stopped, partial 保留}；settled 面停止 = no-op。
- lastScope 保留于 orchestrator，retry()/resumeStaleSweep() 重放同一子集。
- 审计登记: AUDIT_READER_PRODUCT_CAPABILITY_STAGE_REFRESH_2026-08-30.md P1 #1 ACQ-02 关闭。
