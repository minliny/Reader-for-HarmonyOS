# 本轮验证问题记录

- SDK 生成 Settings Builder 的本地探针在加入字段初始化器抽取后触发 TypeScript emitter `isPrologueDirective: node undefined`。触发于本地测试，未操作设备。当前定位范围：探针构造的临时组件及 SDK transform；先将边界缓存实例作为测试环境依赖注入，保留生产方法与真实 Builder 编译，再用正式 ArkTS 检查区分探针限制和应用编译问题。

- Panel 回归用例的旧 frame 桩没有 content 尺寸，新增独立模块姿态发布后报 undefined。代码侧定位为桩数据缺失，已补实际字段并增加发布值断言。
- 本轮期间并行修改了 ReaderControlTtsContent 的选择器：开工快照含 voiceSelectionAvailable，当前源码已经改成下拉选择器，原 playback-content 用例仍抽取已移除方法。保留并行业务修改，记录为共享源码/测试暂时不同步，不恢复旧选择器或用真机排查。
- 目录跳过冗余定位时发现新增 getItemRect 读取若抛错可能阻止必要定位。已改为读取失败仍走原有锚点补偿，继续以本地异常分支回归。
- SDK Builder 探针字段初始化器 emitter 问题已通过在系统边界注入生产缓存实例解决；Settings 实际 SDK 生成观察回调的几何、选择状态和事件回归通过。

- 全量本地首轮 185 组中 13 组失败：11 组属于本轮接口调整后旧测试未同步（模块姿态专用标量、layout Watch、目录新增方法/测量桩）；2 组属于并行朗读选择器重构的旧测试。完整失败输出保存在 full-local-tests.json。更新断言以检查新数据来源，并由生产 Runtime/Builder/行为回归验证实际值，不恢复旧热路径来满足字符串断言。
- HDC 只读目标枚举 10 秒超时，未执行安装、启动、交互或抓取，也未重试。当前任务为代码与本地构建验证，不据此推断设备故障。

- 并行朗读代码已有新的 ReaderTtsConfigOptions 与交互回归。旧 Playback/Preferences 断言仍要求循环切换音色；同步为当前“Full 门禁＋显式配置选择”语义并保留 live observer 检查，仅修改过时测试，没有恢复或改动并行选择器实现。

- 共享构建 build-3 暴露本轮 `BookTurnPresentationSession.ets:72` 的 Native 返回值局部变量被推断为 any，报 ArkTS 10605008。代码侧补充 `const accepted: boolean`，由共享 build-4 的正式 ArkTS 检查通过；不是业务返回值失败，也没有用设备运行规避编译错误。
- 本任务的 build-1 因共享构建锁占用退出，没有进入编译。随后独立核对共享 build-4 的 518/227/15 个输入文件，均与当前一致，复用此正式产物；185 组本地检查、234 项 Native 呈现回归、ArkTS/Native 构建通过，独立 package verify PASS。
- 14:27 UTC 收尾输入复核发现并行任务随后改动 `ReaderTtsConfigOptions.ts` 和 `tools/test-reader-tts-config-interaction.mjs`。本轮渲染修复文件仍匹配通过构建的候选，但整个当前工作区已不能继续声称与 5dc18ed4 完全一致。保留 final-input-match.json / post-build-drift.json，不将并行任务的新构建或设备记录直接当成本轮渲染验收。
- 后续共享 build-5 已纳入这两个变化，产物 `20260911T142756Z-35f2f99a-af695aa8` 完整检查及构建通过。本任务 14:33:38 UTC 全量重建 518/227/15 输入指纹并与该 manifest 快照相等，随后独立包校验 PASS；保持构建与设备证据分层，本轮仍无渲染 VM/真机验收。
