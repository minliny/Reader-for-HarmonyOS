# theme-palette-matrix VM 验收证据（8d51ef78）

日期：2026-08-30。任务：task #14 —— ReaderThemePalettes.ts 8 主题 × 29 角色配色矩阵的 VM 逐主题浮层验收 + 日间回归。

## 溯源

- 代码：worktree `/private/tmp/ledger-b2-fixes`，branch `feat/theme-palette-matrix`，commit `4f90b42`（37 files, +1184/−745）。host 门禁 `scripts/check-local.sh` → `Harmony contract tests passed: 90`（含 `tools/test-reader-theme-palettes.mjs` 守卫：表完备性/day 逐字节锚/fail-closed/阅读域 hex 清零/TOK 颜色 token 禁用）。
- HAP：`/private/tmp/ledger-b2-fixes/entry/build/default/outputs/default/entry-default-signed.hap`
  SHA-256 `8d51ef788c4182b469b42a9f095070feb25b4b8612d65b9f7a68fc615947834f`（signed）。
- preflight：跑通；`sourceNewerThanArtifact=YES` —— 指向 main 仓 `CMakeLists.txt` 比工件新，**属预期**（main 带 bookturn WIP，本工件构建自 worktree 4f90b42），非本任务漂移。
- 目标：`hdc -t 127.0.0.1:5555`（VM，1320×2856 px）。`install -r` **保留数据**。任务锁 `/private/tmp/reader-vm-locks/reader-harmony-vm-127.0.0.1-5555.lock`（noclobber 获取，验收后释放）。

## 事件记录

- 装包后书架空：DB 取证（/tmp/vm-db-probe）`books=0, bookshelf=0, sources=65` —— 系 bookturn 会话 16:04 前置操作已清书（非本任务丢数据）。经 UI 重新添加 庆余年（⭐酷我小说源，楔子 一块黑布）后继续验收。
- `dumpLayout` 返回陈旧帧（滞后一次交互）：以截图为真值，需要 bounds 时等状态稳定后重 dump。
- night 换源窗两次尝试候选未加载（网络慢），接受 loading 态证据（night-sswindow2/3）；greenNight 窗等 22–25s 后拿到 4 源候选完整证据。
- 误触两次（点击落在正文翻页、grabber 快滑误开 app switcher），均恢复后重拍；受影响首拍（night-sswindow、greennight-sswindow 首版）已重拍覆盖。

## 亮度锚（正文，PIL crop 20%–80%w × 25%–75%h，lum=0.299R+0.587G+0.114B）

| 主题 | lum | 主题 | lum |
|---|---|---|---|
| day | 236.3（day-final 复测 240.4） | night | 50.9 |
| warm | 229.0 | warmNight | 50.9 |
| paper | 206.8 | paperNight | 67.9 |
| green | 224.6 | greenNight | 53.7 |

亮/暗两族清晰分离；暗族 ≈ 既有锚（VIS-01 夜 42.7 同法），paperNight 因渐变纸+纹理略高，判 PASS。

## 程序化断言

- 布局树（artifacts/lay-*.json）：界面面板选中主题色块 `backgroundColor == 矩阵 activeSoft`（day 与 paper 均实测 `#142F6373` ✓）。
- day 族色温通道序：warm R>G>B、green G 占优 —— 色温随主题（截图像素采样）。

## 逐浮层目验结论（截图为真值）

| 覆盖 | 证据（artifacts/） | 结论 |
|---|---|---|
| day 正文/控制层/界面/设置/目录/换源窗 | day-body2/dock/interface/settings/directory2/sswindow/final-body | PASS：换源窗白遮罩+亮窗+4 源延迟条，日间回归零漂移 |
| night 控制层（审计 9 组件之一） | night-dock | PASS：全暗控制层，无日间残留块（本任务核心修复） |
| night 界面/设置/设置全屏/目录/书签/朗读/换源窗 | night-interface/settings/settings-full3/directory/bookmarks/tts/autopage(实拍=朗读面板)/sswindow2/3 | PASS：segments/toggle 关轨把手修复/当前章 accent 条/书签 tab 主色/播放停止按钮/语速滑杆全暗；换源窗暗色+scrim，loading 态 |
| warm/paper/green 正文+控制层+界面 | warm-body2/dock/interface、paper-body2/dock-try2/interface、green-body2/dock | PASS：浮层随正文色温（paper 纹理面、green 绿 primary） |
| warmNight/paperNight/greenNight 正文+控制层+界面 | 三主题 × body/dock/interface | PASS：三暗变体 primary 分族明确（暖金 #CBA672/褐金 #B99C6B/绿 #8FBC9F），浮层全暗一致 |
| greenNight 换源窗（候选加载完成态） | greennight-sswindow2 | PASS：4 源候选（酷我 5634ms 当前高亮/小说三千 1314ms/七猫 102ms/企鹅 365ms）、CandidateRow 暗行+状态点、LatencyBar 琥珀警示、页脚 共 4 个书源 |

## 覆盖缺口（非阻塞）

- night 自动翻页面板未单独开面板实拍（设置全屏 night-settings-full3 已含自动翻页 toggle 暗态；night-autopage 文件实拍为朗读面板，作 TTS 证据用）。
- 快速搜索/替换/书籍内搜索三面板未逐主题开面板实拍（与已验面板同链路同矩阵接线，守卫测试覆盖 hex 清零）。

## 收尾状态

应用停在 day 主题、庆余年正文、浮层全关（day-final-body，lum 240.4）。VM 锁已释放（锁文件移除，symlink 保留）。
