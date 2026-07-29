# Device-Ready Execution Checklist — Layer 4 + Bug 2/4/6

> 状态：执行中（模拟器已验证 reading-surface；真机与 release identity 仍属于 B7）
> 生成时间：2026-07-30
> 前置条件：hdc target 可达 + 设备已解锁 + 当前 release identity HAP 已安装

## 执行顺序

1. **Bug 2**：HostCapabilityManifest self-check（解锁 deviceVerified）
2. **Bug 4**：verticalScrollCheck 启动参数验证
3. **Bug 6**：settings tab 路由验证
4. **Bug 1**：HUKS 加密集成（如选择推进）
5. **Layer 4**：28 个 unfrozen bindings 逐项冻结

## Step 1: Bug 2 — HostCapabilityManifest self-check

### 启动参数
```
hdc shell aa start -a EntryAbility -b com.minliny.reader --ps selfCheck true
```

### 期望日志
```
[CoreSelfCheck] ping ok=true
[CoreSelfCheck] coreInfo={...}
[HostManifest] post-self-check summary total=41 deviceVerified=N
```

### 成功条件
- `ping ok=true`
- `deviceVerified` 数量 > 0（理想情况下全部翻转）
- 无 `self-check failed` 错误日志

### 失败处理
- 如果 `ping ok=false`：检查 Core 模块加载，可能是 native lib 缺失
- 如果 `deviceVerified=0`：检查 capability 实现是否完整
- 不得手动设置 `deviceVerified=true`

## Step 2: Bug 4 — verticalScrollCheck 启动参数

### 启动参数
```
hdc shell aa start -a EntryAbility -b com.minliny.reader --ps verticalScrollCheck true
```

### 期望日志
```
[EntryAbility] verticalScrollCheck=true — importing only the long local-book scroll probe
[verticalScrollCheck] enteredReader=true bookId=...
[verticalScrollCheck] result=ready paragraphs=... paginationMode=vertical pageAnimation=scroll
```

### 成功条件
- 启动参数被正确读取
- 通过真实 Core-backed shelf-open transaction 进入阅读页
- `pageAnimation=scroll` 严格映射为 `paginationMode=vertical`
- 正文上滑前后可见段落发生变化，且布局验证器通过
- 无 `verticalScrollCheck failed` 错误

## Step 3: Bug 6 — settings tab 路由验证

### 操作步骤
1. 正常启动应用
2. 点击底部 settings tab
3. 观察渲染的页面

### 期望行为
- 渲染的是 `settings-general` 路由（不是旧的 `settings` tab）
- 日志中出现 `route-replace id=settings-general`

### 验证日志
```
hdc shell hilog | grep -E "route-replace|settings-general"
```

### 成功条件
- 点击 settings tab 后日志出现 `settings-general`
- 页面渲染的是 Settings General 全页面

## Step 4: Bug 1 — HUKS 加密集成（可选，较大工程）

### 前置条件
- Bug 2/4/6 已验证通过
- 确认 HUKS API 在目标设备可用

### 实现步骤
1. 在 `CredentialHostAdapter.ets` 中导入 `@ohos.security.huks`
2. 实现 key generation（keyAlias = 'reader_credential_key'）
3. 实现 encrypt(value: string): string（返回 base64 密文）
4. 实现 decrypt(cipher: string): string
5. 修改 `set()`：加密后存入 preferences
6. 修改 `get()`：从 preferences 取密文，解密后返回
7. 实现 migration：检测旧明文数据，加密后覆盖
8. 翻转 `supportsProtectedSecrets()` 返回 `true`

### 验证步骤
1. 写入测试凭据：`credential.set({key: 'test', value: 'secret123'})`
2. 读取 preferences 原始值：`hdc shell ...` 确认非明文
3. 读取凭据：`credential.get({key: 'test'})` 确认返回 `secret123`
4. 删除凭据：`credential.delete({key: 'test'})` 确认删除
5. Migration 测试：先写入明文，启动应用，确认自动加密

### 成功条件
- preferences 中存储的是密文，非明文
- 加密/解密链路完整
- migration 正确处理旧明文数据
- `supportsProtectedSecrets()` 返回 `true`

## Step 5: Layer 4 — 28 个 unfrozen bindings 冻结

### 按页面族分组执行（推荐顺序）

#### 5.1 Reader（13 个 bindings）
最高优先级，阅读主链。

| binding id | 操作 | 证据 |
|-----------|------|------|
| reader.reading-surface | 打开任意书籍，进入阅读 | 截图 |
| reader.control-home | 点击屏幕中部唤出控制层 | 截图 |
| reader.module.directory | 点击目录按钮 | 截图 |
| reader.module.tts | 点击 TTS 按钮 | 截图 + 录屏（动效）|
| reader.module.appearance | 点击外观按钮 | 截图 |
| reader.module.settings | 点击设置按钮 | 截图 |
| reader.quick.auto-page | 快捷面板自动翻页 | 截图 + 录屏 |
| reader.quick.content-search | 快捷面板内容搜索 | 截图 |
| reader.quick.content-replacement | 快捷面板内容替换 | 截图 |
| reader.full.directory | 全屏目录 | 截图 |
| reader.full.tts | 全屏 TTS | 截图 |
| reader.full.appearance | 全屏外观 | 截图 |
| reader.full.settings | 全屏设置 | 截图 |

#### 5.2 Bookshelf（5 个 bindings）
| binding id | 操作 | 证据 |
|-----------|------|------|
| bookshelf.page | 进入书架 | 截图 |
| bookshelf.book-card | 查看书卡 | 截图 |
| bookshelf.action-sheet | 长按书卡唤出操作表 | 截图 + 录屏 |
| bookshelf.multi-select | 多选模式 | 截图 |
| bookshelf.local-import-dialog | 本地导入对话框 | 截图 |

#### 5.3 Book Detail（2 个 bindings）
| binding id | 操作 | 证据 |
|-----------|------|------|
| book-detail.page | 点击书卡进入详情 | 截图 |
| book-detail.chapter-row | 查看章节列表 | 截图 |

#### 5.4 Source Switch（1 个 binding）
| binding id | 操作 | 证据 |
|-----------|------|------|
| source-switch.window | 从书详情进入换源 | 截图 + 录屏 |

#### 5.5 其余页面族（7 个 bindings）
| binding id | 操作 | 证据 |
|-----------|------|------|
| source-management.final | 进入书源管理 | 截图 |
| webdav.config | 进入 WebDAV 配置 | 截图 |
| sync-backup.page-and-restore-overlay | 进入同步备份 | 截图 |
| sync-backup.restore-backup-overlay | 打开恢复覆盖层 | 截图 + 录屏 |
| search.five-state | 进入搜索 | 截图（5 个状态）|
| rss.page | 进入 RSS | 截图 |
| discover.page-route-variants | 进入发现页 | 截图 |

### 冻结流程（每个 binding）

1. 导航到 binding 对应路由
2. 采集证据（截图 / 录屏）
3. 在 Reader-UI 的 `FIGMA_VISUAL_ADMISSION_REGISTRY.json` 中：
   - 填入 `delivery.deviceEvidence`（截图路径 + 设备 ID + 时间戳）
   - 填入 `delivery.motionEvidence`（如涉及动效，录屏路径）
   - 将 `deliveryStatus` 从 `current-read-unfrozen` 改为 `current-read-frozen-deliverable`
4. 运行 `npm run check:reader-ui-consumer` 确认 PASS
5. 在 Reader-UI 侧提交（HarmonyOS 侧不写入 registry）

### 成功条件
- 28 个 binding 全部冻结
- `current-read-unfrozen` 数量为 0
- `current-read-frozen-deliverable` 数量为 28
- `check:reader-ui-consumer` PASS

## 不可做的

- 不得伪造 device evidence / motion evidence
- 不得用模拟器截图冒充真机证据
- 不得用历史截图冒充当前 release 证据
- 不得跳过 motion evidence（如 binding 涉及动效）
- 不得在 device evidence 缺失时将 status 改为 frozen-deliverable
- 不得手动设置 `deviceVerified=true`
- 不得跳过任何 binding

## 参考

- [LAYER4_UNFROZEN_BINDINGS.md](./LAYER4_UNFROZEN_BINDINGS.md)
- [LAYER5_FUNCTIONAL_BUGS.md](./LAYER5_FUNCTIONAL_BUGS.md)
- [REPAIR_ROADMAP.md](./REPAIR_ROADMAP.md)
