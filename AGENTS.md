

## 统一 HarmonyOS 签名默认（2026-09-29）

用户指定：本机和 FnOS 的所有 HarmonyOS 开发环境，默认且唯一使用华为开发者管理页的 `minliny_HarmonyOS` 调试证书。

- 证书 SHA256：`3A563778E5BF17CD3EAD0218E13B4A5030DE3F5D7D4E21E0336D8EB37B676DC4`；序列号 `09FD49ED9FBBF0F38278FBE3811C`；有效期至 2027-09-29。
- 用户级权威配置：`~/.codex/harmony-signing/authority.json`，同目录 `certificate.cer` 为管理页证书的精确副本；所有新建工作区继承此约束。
- 用户级私有签名默认：`~/.codex/harmony-signing/current/build-profile.json5`，配套当前 `Minliny_Profile`。新 Reader 工作区通过规范 `sync-signing --profile ~/.codex/harmony-signing/current/build-profile.json5` 导入；文件和加密口令材料仅限私有目录，不得进入 Git。其他应用仍需与其自身包名匹配的有效 Profile。
- 私有签名配置必须使用该证书匹配的 keystore 和对应应用包名的有效 Profile。缺少口令/私钥/Profile 时停止并明确说明，不得改用自动生成的证书、旧证书或另一签名体系。
- 用户于 2026-09-29 明确批准：Reader 包名统一为 `io.reader.minliny`（原包名因华为保留字符限制停止使用）。`reader.minliny.testpackage` 的旧 Profile 不能用于当前 Reader。
- 不自动申请/生成/轮换/废除证书，不因签名失败卸载或清除应用数据。证书变更须由用户重新明确指定。
- 新环境和新构建入口必须接入签名身份校验；现有 Reader 的 `sync-signing`、signed build、HAP 验签均检查证书和 Profile 的签名身份。
- 该默认策略不表示密钥库已解锁、Profile 已配齐或 signed 构建已通过；这些结果必须单独验证。
