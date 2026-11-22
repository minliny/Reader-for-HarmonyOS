# Reader UI 验证

HarmonyOS 通过正常入口采集书源管理、书架搜索与阅读控制面板。每次只选一个已登记的 `--case`，Android 和 iOS 的 dry-run 会列出 UNSUPPORTED。记录采集时的页面登记快照。首期封存回执继续由交接包内的 `phase0.2` 工具重放。

运行环境为能执行本仓 Node 工具的 Node.js。胶囊转场的离线复算还需要本机 Node 的 TypeScript 类型擦除和同步模块加载能力，已用 Node 26 核对。先在联网环境执行 npm ci --prefix tools/ui-contract 安装锁定的 Ajv 和 pngjs。接收方可留存可信工具及依赖，然后在断网环境重放。

```sh
node tools/ui-contract/cli.mjs --case bookshelf.search-input-ime --dry-run
node tools/ui-contract/cli.mjs --case reading.control-open-motion --dry-run --platform ios
node tools/ui-contract/cli.mjs --case source-management.layout-filter --dry-run
node tools/ui-contract/cli.mjs --case bookshelf.search-edit-resubmit-back --dry-run
node tools/ui-contract/cli.mjs --case reading.control-search-morph-back --dry-run
node tools/ui-contract/cli.mjs --case reading.control-search-interrupted-back --dry-run
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
| publicSources、publicInputs、publicBookTitleConfirmed、publicBookTitlesConfirmed | 根据所选 Phase 1 case 实际确认公开书源集合、输入角色和被选择的公开本地图书，只写所需事实。输入命令日志仅保留长度。 |
| publicDocument | 只在 `source-management.import-research-status-action` 填写。核对所选目标 Download 中文件的实际读回字节和合同 SHA-256，再记录 `basename`、`sha256`。核对所经系统选择器视图仅含公开文件名后写入 `pickerPublic: true`。 |
| captureAfterOnlineSweep | 可选搜索采集设置。仅在在线源持续更改结果导致取样失败时使用，待当前首轮停止更新再取样，最多等待 300 秒。 |
| directRoute.clientToServer、directRoute.serverToTarget | 两段各记录 direct: true、socketObservation、routeObservation。记录实际现场依据。 |

操作前，VM 的 emulator 日志必须来自已确认的当前实例。真机使用本机 HDC server，并单独核验授权、官方保数据准入和隔离测试环境。工具在已取得的租约里确认准确目标、boot、SceneBoard、已安装候选和正常启动，依次执行所选 case。每次提供新的输出目录。留存原始图、树和日志的目录权限默认为 0700。

搜索用例允许公开本地书成为命中结果。已有在线书源按正常应用语义参与；结果页实际可见数据同样须在公开范围内。

书源导入后重搜用例从公开空库经正常搜索进入书源管理。系统选择器的四个仅树定位步骤必须观察到同一 Reader 窗口中的准确转场，依次找到「浏览」「我的手机」和 Download 内指定公开 JSON。原生界面或命令不匹配时原地结束取证。正式样本再核对 Core 写入及列表读回、同开次按钮和重启的真实搜索结果。

选择器的离线档案检查用已封存的 Phase 1 证据目录核对实际图树与原始命令。

```sh
READER_SOURCE_PICKER_ARCHIVE="$PHASE1_EVIDENCE" node --test \
  --test-name-pattern '^(native source document picker locates|status import (requires|normalizes))' \
  tools/ui-contract/test/source-document-picker.test.mjs
```

书架软键盘提交用例从同一份键入后样本校验当前编辑焦点、系统输入法窗口、键盘矩形和截图中搜索键的字形像素。该输入仅用于已证实的 Huawei 输入法竖屏配置。离线复算生成同一个相对键盘位置，核对原生触摸回执及随后的 TextInput 提交意图和业务接受。

阅读中断用例在同一动作里点按实测 Search 快捷态抓柄，随即发送普通 Back。日志分别保留两个输入回执。接收方根据 App 实际发出的旧代际撤销、Back 消费归属、新代际提交和原生帧判断是否观测到转场重叠。Back 若在旧转场提交后才到达，该项记为 NOT_RUN。

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

交接双方分别留存 receipt 根 SHA-256 和工具目录内的 `tool-identity.json`。导出保留用例、采集时的 model/register、依赖字节与许可证。将完整工具及证据目录交给接收方，在工具目录执行离线重放。重放从实际文件复算工具摘要，再与回执、独立根摘要和候选身份核对。采集结束后填入的新登记与冻结工具分别保存。

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

Phase 1 coverage 只接受显式选择文件。每组列出候选相同、目标相同且初始窗口配置兼容的运行。接收方从独立交接记录填写 `expectedRoot`。文件中的路径相对于选择文件。候选汇总跨组复用同一签名、源码快照、构建身份、工具和目标类别的完整单案。每条证据仍显示其实际目标、窗口、会话及根。必需用例未选择时列为缺口。整案条件未观察时单列 `UNEXERCISED`，已选却缺适用性事实时列为 `UNKNOWN`。

```json
{
  "groups": [{
    "id": "local-vm-default-font",
    "runs": [{
      "case": "source-management.layout-filter",
      "receipt": "source/receipt.json",
      "expectedRoot": "<independently recorded receipt SHA-256>"
    }]
  }]
}
```

```sh
node tools/ui-contract/coverage.mjs --selection "$SELECTION"
node tools/ui-contract/reseal.mjs --case source-management.layout-filter \
  --input "$ORIGINAL_RECEIPT" --expected-root "$ORIGINAL_ROOT" --output-dir "$DERIVED_DIR"
```

用更新后的求值器复算同一封存采集时，`reseal.mjs` 检查原根摘要、用例、原始引用和证据字节，在新目录生成回执和派生关系。新的工具、派生根摘要以及原回执同时保留。

`reseal.mjs --reuse-capture` 接受新增结构绑定的同一用例。动作、采样步骤、夹具、来源、功能断言和用例版本必须与原合同一致；保留原合同，并按当前结构与功能求值器重新生成回执。若旧用例版本或动作发生变化，使用 `reassess-structure.mjs --input <原回执> --expected-root <独立原根> --bindings <旧状态样本映射> --output <新报告>`。重评报告引用原包并保留旧功能结论，只能用于其原候选与原会话，不能代替当前用例回执参与登记。

场景按模型义务报告结构和整体结论。可证明的失败会与未完成观测同时保留。书源登记依旧核对映射的规则、样本、原生证据和实际生产源码身份。查变更影响用 `node tools/gate-index-impact.mjs --affected <仓库相对路径>`，或用 `--deps structure-rule:<准确规则ID>` 查前置与引用方。
