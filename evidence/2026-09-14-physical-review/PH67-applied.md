# PH67：用户批准的四套浅色阅读背景已应用

用户在本轮明确回复“按你的建议来吧”，授权采纳 `PH60-61-66-67-bookshelf-theme.md` 中四套候选。这里是该新决定的实现记录，不把原 Make / PH43 历史色值改称设计错误，也不修改原设计证据。

|主题 ID|PH43 / Make 基线|本轮批准及已应用|
|---|---|---|
|day|#FCF8F0|#F7F3EA|
|warm|#F4E3BF|#F2E8D3|
|paper|#EBDABB|#EEE4D0|
|green|#D7E8CF|#E3EBDD|

每套同步修改 `paperStart`、`paperEnd`、`swatch`、`statusBackground`、`paperBack`，alpha 均继续为 1。总计20个背景角色及4条 provenance。唯一源是 `Reader-UI/theme/registry.json`，由现有 `generate-theme-registry.mjs` 生成 Reader-UI 与 HarmonyOS 的同字节 TypeScript adapter；没有额外平台 palette。

`PH67-change-scope.json` 保存修改前后 canonical SHA 与逐角色变更，执行时先回填允许变更字段再比较完整配置，确认其他字段语义完全相同；App 注册表片段连原字节也保持。正文 ink、顶部信息 chromeMeta、状态栏前景、选区、阴影、纹理效果、夜间四套、主题 ID/顺序/默认选择与双向联动均未修改。paper 仍保留纸纹及既有 lighting 标记；green 没有额外开启纸纹。主题逻辑/用户保存配置不需要迁移。

验证没有仅比较两个共用同一注册表的消费者。`test-reader-theme-paper-origin.mjs` 保留独立原 Make 八色断言，并另写本次批准四浅色和四原夜间色的八个独立当前锚点；调用实际 ReadingSurface、控栏色块及 reader/overlay Window 颜色方法，并逐项检查五角色、既有文字色与纹理。先用旧 adapter 运行得到真实红例（day 仍 #FFFCF8F0），现有生成器更新后转绿。`test-reader-appearance-make` 同步验证Quick/Full和共享色块轨道；`test-reader-appearance` 更新纸纹背景的明确期望。

本地6组针对性回归全部通过：

- `test-reader-theme-paper-origin`
- `test-reader-appearance-make`
- `test-reader-appearance`
- `test-reader-theme-selection`（主题双向联动）
- `test-reader-appearance-theme-extension`（额外主题扩展）
- `test-svg-provenance`

`generate-theme-registry.mjs --check` 通过，583个App角色×2、8套阅读配色及两个adapter一致。原始红绿日志在 `PH67-local-regression/`。

**SVG 没有生成或改色。** 由于现有 SVG provenance 把整个 theme adapter SHA 当依赖，本次仅刷新其中166条 `themeRegistrySha256`。352个SVG逐字节均未改变，没有运行图标生成器。`PH67-provenance-metadata.json` 记录旧/新依赖SHA、条目数与0图标变更；正式来源校验已通过。

待提交文件：Reader-UI 的 canonical registry 和生成 adapter；HarmonyOS 的生成 adapter、三份上述主题/外观测试、SVG provenance 元数据；本报告与PH67证据。没有修改共享总账或 READER_REPAIR_SPEC，没有提交、构建HAP或操作设备。生产和测试已冻结，最终完整构建/安装/用户实际观感由根任务分层记录。
