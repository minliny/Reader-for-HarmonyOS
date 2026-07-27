# Layer 5 — 功能 Bug 与设备复测计划

> 状态：部分阻塞（功能 bug 可本地识别，复测需要真机）
> 生成时间：2026-07-26
> 当前 rollout：7 Pilot / 28 Shadow / 0 Authoritative

## 目标

识别并修复当前已知的功能缺口，然后在真机上完成复测。功能修复可在本地推进；最终验证需要 hdc 设备。

## 已知功能缺口（从代码识别）

### Bug 1：CredentialHostAdapter 明文存储敏感凭据

- **位置**：`entry/src/main/ets/host/adapters/CredentialHostAdapter.ets:19`
- **现状**：credentials 以明文存入 `@ohos.data.preferences`
- **风险**：敏感凭据（密码、API key、token）明文落盘
- **修复方向**：接入 HUKS（`@ohos.security.huks`）加密，seam 已留好但 crypto 未实现
- **阻塞**：本地可实现 HUKS 集成；需设备验证加密/解密链路

### Bug 2：部分 Host capability 的 deviceVerified=false

- **位置**：`entry/src/main/ets/host/HostCapabilityManifest.ets:129+`
- **现状**：所有 capability 的 `deviceVerified` 默认 false，只有真机 self-check 能翻转
- **影响**：当前 15 个 registry capability + 26 个 reducer-direct capability 中，仅 14 个有历史 deviceVerified 记录（2026-07-08 设备 af2137d），不构成当前 release 证据
- **修复方向**：在 hdc 设备上运行 `selfCheck=true` 启动参数，采集 `[HostManifest] post-self-check summary` 日志
- **阻塞**：必须真机

### Bug 3：历史 Source Switch 结果路由残留已移除

- **位置**：`entry/src/main/ets/ui/components/LibraryComponents.ets:152`
- **现状**：`SourceSwitchResultsPanel` 已删除（commit `c9a6bdb`），但注释仍提到 "old static result route"
- **影响**：无功能影响，仅注释陈旧
- **修复方向**：清理注释，确认 `source-switch-results` 路由在 `ReaderUIScreenGraphRetirementRegistry.ets` 已退休
- **阻塞**：本地可完成

### Bug 4：verticalScrollCheck 启动参数未经设备验证

- **位置**：`entry/src/main/ets/entryability/EntryAbility.ets:134`
- **现状**：新增 `verticalScrollCheck` launch 参数，逻辑已写入 `bootstrapCoreAfterRestore`
- **影响**：参数存在但未经真机验证
- **修复方向**：在 hdc 设备上用 `verticalScrollCheck=true` 启动，采集日志
- **阻塞**：必须真机

### Bug 5：reader-tts-start / reader-tts-stop 事件处理器合并到 toggleTtsPlayback

- **位置**：`entry/src/main/ets/ui/store/ReaderReducer.ets:476-479`
- **现状**：`reader-tts-start` 直接调用 `toggleTtsPlayback`，`reader-tts-stop` 调用 `setActiveSession('')`
- **风险**：`reader-tts-start` 在 TTS 已运行时会变成 stop（toggle 语义），而非保持播放
- **修复方向**：`reader-tts-start` 应改为幂等启动（若已运行则 no-op），`reader-tts-stop` 应幂等停止
- **阻塞**：本地可修复；需设备验证 TTS 状态流转

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

| 类型 | 可本地推进 | 必须设备 |
|------|-----------|---------|
| Bug 1 HUKS 集成 | ✅ 代码实现 | 验证加密链路 |
| Bug 2 deviceVerified | ❌ | ✅ self-check 日志 |
| Bug 3 注释清理 | ✅ | 无 |
| Bug 4 verticalScrollCheck | ❌ | ✅ 启动参数验证 |
| Bug 5 TTS 幂等 | ✅ 代码修复 | ✅ 状态流转验证 |
| Bug 6 settings 路由 | ❌ | ✅ 路由渲染验证 |

## 不可做的

- 不得伪造 deviceVerified=true
- 不得用历史 self-check 日志冒充当前 release 证据
- 不得在未运行 self-check 时声称 capability 已验证
- 不得跳过 TTS 幂等性测试
- 不得用模拟器日志冒充真机证据
