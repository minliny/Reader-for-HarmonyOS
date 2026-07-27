# Layer 5 — 功能 Bug 与设备复测计划

> 状态：部分阻塞（功能 bug 可本地识别，复测需要真机）
> 生成时间：2026-07-26
> 当前 rollout：7 Pilot / 28 Shadow / 0 Authoritative

## 目标

识别并修复当前已知的功能缺口，然后在真机上完成复测。功能修复可在本地推进；最终验证需要 hdc 设备。

## 已知功能缺口（从代码识别）

### Bug 1：CredentialHostAdapter 明文存储敏感凭据

- **位置**：`entry/src/main/ets/host/adapters/CredentialHostAdapter.ets:19`
- **现状**：credentials 以明文存入 `@ohos.data.preferences`，`supportsProtectedSecrets()` 返回 `false`
- **风险**：敏感凭据（密码、API key、token）明文落盘
- **修复方向**：接入 HUKS（`@ohos.security.huks`）加密，seam 已留好但 crypto 未实现
- **阻塞**：HUKS 是系统级 API，需要设备验证 key generation/encryption/decryption/migration 全链路；本地无法验证
- **分类修正**：原标记为"本地可推进"，实际应为"设备阻塞"——HUKS 集成是较大工程，且 `supportsProtectedSecrets()=false` 已是已知设计决策，非隐藏 bug

### Bug 2：部分 Host capability 的 deviceVerified=false

- **位置**：`entry/src/main/ets/host/HostCapabilityManifest.ets:129+`
- **现状**：所有 capability 的 `deviceVerified` 默认 false，只有真机 self-check 能翻转
- **影响**：当前 15 个 registry capability + 26 个 reducer-direct capability 中，仅 14 个有历史 deviceVerified 记录（2026-07-08 设备 af2137d），不构成当前 release 证据
- **修复方向**：在 hdc 设备上运行 `selfCheck=true` 启动参数，采集 `[HostManifest] post-self-check summary` 日志
- **阻塞**：必须真机

### Bug 3：SourceStatus 点击仍 push 到已退休的 source-switch-results 路由 — 已修复 ✅

- **位置**：`entry/src/main/ets/ui/components/ContractComponents.ets:78`
- **现状**：`SourceStatus` 组件的 onClick 仍 dispatch `route-push` 到 `source-switch-results`，但该路由已在 `ReaderUIScreenGraphRetirementRegistry.ets` 退休
- **修复**：改为 `source-switch`（实时换源流程），与 `SourceCoreUnavailablePage` 的 `primaryRoute: 'source-management'` 方向一致
- **验证**：`source-switch-results` 在退休 registry 中已登记（line 26），`source-switch` 是实时窗口不应退休

### Bug 4：verticalScrollCheck 启动参数未经设备验证

- **位置**：`entry/src/main/ets/entryability/EntryAbility.ets:134`
- **现状**：新增 `verticalScrollCheck` launch 参数，逻辑已写入 `bootstrapCoreAfterRestore`
- **影响**：参数存在但未经真机验证
- **修复方向**：在 hdc 设备上用 `verticalScrollCheck=true` 启动，采集日志
- **阻塞**：必须真机

### Bug 5：reader-tts-start / reader-tts-stop 幂等性 — 已验证无需修复 ✅

- **位置**：`entry/src/main/ets/ui/store/ReaderReducer.ets:476-479`
- **现状**：`reader-tts-start` 调用 `toggleTtsPlayback`，`reader-tts-stop` 调用 `setActiveSession('')`
- **验证结果**：`toggleTtsPlayback` 在 line 2044-2046 已有幂等检查——`activeSession === 'tts' && playback === 'playing'` 时直接返回 state（no-op）。注释 line 2041 也明确 "Starting is idempotent"。
- **结论**：`reader-tts-start` 在 TTS 已播放时是 no-op，不会变成 stop。Bug 不存在。

### Bug 6：settings tab 路由改到 settings-general 未经验证

- **位置**：`entry/src/main/ets/ui/store/ReaderReducer.ets:27`
- **现状**：`case 'settings': return 'settings-general'`（从 `settings` 改为 `settings-general`）
- **影响**：Figma Settings General 是独立全页面，不是 tab 导航。改动方向正确，但未经设备验证
- **修复方向**：在 hdc 设备上验证 settings tab 进入后渲染的是 settings-general 路由
- **阻塞**：必须真机

## 设备复测清单（hdc 就绪后执行）

| # | 复测项 | 启动参数 | 期望日志/行为 | 覆盖 bug |
|---|-------|---------|--------------|---------|
| 1 | CoreSelfCheck | `selfCheck=true` | `[CoreSelfCheck] ping ok=true` + coreInfo | Bug 2 |
| 2 | HostManifest 全量 self-check | `selfCheck=true` | `[HostManifest] post-self-check summary total=41 ... deviceVerified=N` | Bug 2 |
| 3 | verticalScrollCheck | `verticalScrollCheck=true` | 竖向滚动链路日志 | Bug 4 |
| 4 | TTS 启停幂等性 | 正常启动 | 连续两次 `reader-tts-start` 不变成 stop | Bug 5 |
| 5 | Settings tab 路由 | 正常启动 | 点击 settings tab 进入 settings-general 路由 | Bug 6 |
| 6 | Credential HUKS 加密 | 正常启动 | 写入凭据后 preferences 中非明文 | Bug 1 |

## 本地可推进 vs 设备阻塞

| 类型 | 可本地推进 | 必须设备 | 状态 |
|------|-----------|---------|------|
| Bug 1 HUKS 集成 | ❌ 系统级 API | ✅ 全链路验证 | 设备阻塞 |
| Bug 2 deviceVerified | ❌ | ✅ self-check 日志 | 设备阻塞 |
| Bug 3 路由残留 | ✅ 已修复 | 无 | **已完成** |
| Bug 4 verticalScrollCheck | ❌ | ✅ 启动参数验证 | 设备阻塞 |
| Bug 5 TTS 幂等 | 已验证无需修复 | — | **已完成** |
| Bug 6 settings 路由 | ❌ | ✅ 路由渲染验证 | 设备阻塞 |

## 不可做的

- 不得伪造 deviceVerified=true
- 不得用历史 self-check 日志冒充当前 release 证据
- 不得在未运行 self-check 时声称 capability 已验证
- 不得跳过 TTS 幂等性测试
- 不得用模拟器日志冒充真机证据
