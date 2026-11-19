# Reader UI 验证 · Phase 0

在 HarmonyOS 正常书架和阅读入口采集两条切片。Android 和 iOS 的 dry-run 会列出 UNSUPPORTED。页面登记读取现有 register.json。

运行环境为能执行本仓 Node 工具的 Node.js。先在联网环境执行 npm ci --prefix tools/ui-contract 安装锁定的 Ajv。接收方可留存可信工具及依赖，然后在断网环境重放。

```sh
node tools/ui-contract/cli.mjs --case bookshelf.search-input-ime --dry-run
node tools/ui-contract/cli.mjs --case reading.control-open-motion --dry-run --platform ios
```

## 现场采集

使用通过现有 HAP 流水线验签、保数据安装并启动的候选。同一目标上分别定位到书架，保持普通入口状态。搜索输入词在 case 中固定为 Reader。阅读使用本目录 fixtures 中的公开测试书，经正常导入流程从书架打开。测试环境需要开启开发者模式，书架、历史、搜索结果和输入法候选需为公开测试数据。

每条 case 的 fixture JSON 来自现场核对，需含以下字段。

| 字段 | 写入依据 |
| --- | --- |
| schema | reader-ui-public-fixture-v1 |
| caseId、fixtureId | 所选 case 及其 fixture.id |
| targetRef、hdcServer | 该目标实际部署回执 |
| checkedAt | 本次核对时的 ISO 8601 时间 |
| vmName | 已核验的 VM 实例名称，真机用 physicalTestDevice: true |
| publicBooks、publicHistory、publicImeCandidates、developerMode、noPersonalData | 确认均为 true 后执行 |
| captureAfterOnlineSweep | 可选搜索采集设置。仅在在线源持续更改结果导致取样失败时使用，待当前首轮停止更新再取样，最多等待 300 秒。 |
| directRoute.clientToServer、directRoute.serverToTarget | 两段各记录 direct: true、socketObservation、routeObservation。记录实际现场依据。 |

操作前，VM 的 emulator 日志必须来自已确认的当前实例。真机使用本机 HDC server，并单独核验授权、官方保数据准入和隔离测试环境。工具在已取得的租约里确认准确目标、boot、SceneBoard、已安装候选和正常启动，依次执行所选 case。每次提供新的输出目录。留存原始图、树和日志的目录权限默认为 0700。

搜索用例允许公开本地书成为命中结果。已有在线书源按正常应用语义参与；结果页实际可见数据同样须在公开范围内。

```sh
node tools/ui-contract/cli.mjs --case bookshelf.search-input-ime \
  --manifest "$MANIFEST" --deployment "$DEPLOYMENT" --hdc "$HDC" \
  --server "$SERVER" --target "$TARGET" --vm-log "$VM_LOG" --fixture "$SEARCH_FIXTURE" --output-dir "$SEARCH_OUT"
node tools/ui-contract/cli.mjs --case reading.control-open-motion \
  --manifest "$MANIFEST" --deployment "$DEPLOYMENT" --hdc "$HDC" \
  --server "$SERVER" --target "$TARGET" --vm-log "$VM_LOG" --fixture "$READING_FIXTURE" --output-dir "$READING_OUT"
```

## 离线复核

在采集工作区安装锁定依赖后，可将同版本工具复制到新的独立目录。

```sh
node tools/ui-contract/export-replay.mjs "$REPLAY_TOOL_DIR"
```

交接双方分别留存 receipt 根 SHA-256 和工具目录内的 `tool-identity.json`。导出保留两份 case、页面登记以及本次安装依赖的字节和许可证。将完整工具目录及证据目录交付给接收方，并从工具目录运行下述命令。接收方预装 Node.js 即可离线重放。重放从实际工具和依赖字节复算工具摘要，再与 receipt 核对。两份回执用各自部署记录的 HDC server、目标引用和目标类型核对是否来自同一目标。

```sh
node tools/ui-contract/cli.mjs --case bookshelf.search-input-ime \
  --replay "$SEARCH_OUT/receipt.json" --expected-root "$SEARCH_ROOT_SHA256"
node tools/ui-contract/cli.mjs --case reading.control-open-motion \
  --replay "$READING_OUT/receipt.json" --expected-root "$READING_ROOT_SHA256"
node tools/ui-contract/coverage.mjs \
  --search "$SEARCH_OUT/receipt.json" --search-root "$SEARCH_ROOT_SHA256" \
  --reading "$READING_OUT/receipt.json" --reading-root "$READING_ROOT_SHA256"
```

重放按发布的 case 版本和可信工具字节校验，逐项复算 actual、expected、verdict 与证据引用。故障和缺字段记录在原始 session 及 diagnostics；所选必需项缺证或可信行为违例均退出非零。证据包可在本地解析候选 manifest、deployment、源码快照与必要 owner 文件。部署回执提供安装 HAP 的 SHA-256，设备的当前 bundle identity 由同一租约内的开始与结束读证核对。原生屏幕呈现和帧回调读数分别解释。
