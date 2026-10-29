# 共同视觉规格参考入口

全应用跨平台交接及本轮选定版本见[跨平台界面参考](../cross-platform-reference/README.md)。本目录继续负责换源专项共同视觉输入与原稿来源，不作为全应用页面/交互总规格。

入口为 `index.html`。它复用用户选定第三版换源稿的原交互模型、阅读/控制栏组件、DOM、封面与阅读基底；换源组件实际加载 `source-switch-reference.css`。动画参数、字体与自适应参数来自 `Reader-UI/design/source-switch/source-switch.visual.json`，同一输入也生成原生 `SourceSwitchVisual.ts` 和小说 Typography 角色。

这是可随 Reader 工作区移动的参考入口，不再依赖相邻 worktree。`approved-source/` 保存 22 个原稿文件的精确字节及 `archive-manifest.json`；封面与历史页面索引的直接依赖一并归档。原稿 CSS 不修改，`rebased/` 只重定位资源 URL，字体和 SVG 复用本 Host 的已记录资产；paired Reader-UI 的共同规格仍是唯一视觉输入。`reference-manifest.json` 保存归档来源、所有依赖路径/hash、派生 bundle/hash、公共定义 hash 及检查边界。单独复制该目录而没有同工作区的 Host 资源和 paired UI 输入，不是支持的部署方式。

画布外可选原稿、VM、窄宽、短屏或极短窗口配置，也可输入字体倍率与安全边距。宽/短/字体缩放/整页滚动是明确登记的自适应扩展，标准390×844/倍率1保留100高书籍区。原稿文字线框88.1超过其84高内区；参考允许可见溢出，原生在100高外区居中形成对应布局。当前业务定位章节开头，因此只修正切换说明和完成反馈中的阅读位置文案。示例查找与切换仍为模拟，不能作为真实Core/事务/位置恢复证据。

检查命令（在Host根目录）：

```sh
npm ci --ignore-scripts --no-audit --no-fund --prefix docs/ui-design
node tools/generate-source-switch-visual.mjs --check
node docs/ui-design/source-switch-reference/build-reference.mjs
node docs/ui-design/source-switch-reference/build-reference.mjs --check
```

构建依赖声明在 `docs/ui-design/package.json` 和 `package-lock.json`，使用精确版本 esbuild `0.28.2`；从同目录 `node_modules` 加载，没有历史 evidence 目录回退。参考 manifest 同时绑定 package 与 lockfile 哈希。静态入口直接加载已生成 bundle，不需要运行构建器或 Node；无需启动服务。构建执行10个自适应参数检查、4个静态模板资源解析、15个模板资产检查，并记录公共CSS/原生输入的一致hash。模板与数学检查不是浏览器渲染。当前 `browserRendered=false`、`browserPlayback=false`、原生视觉验收OPEN。

`approved-source/LOGIC.md` 是历史索引的原始输入；当前产品文案应写入当前 baseline/spec，不能直接改写已批准归档。原稿字节由 `archive-manifest.json` 锁定；本次恢复了被后续当前文案改动污染的两处归档文本，恢复内容与已记录 SHA-256 及历史源副本一致，未改写原始来源哈希。

`font-provenance.json` 保存一次FontTools4.60.2的只读字体检查：VF与UI静态400/500均为Noto版本2.004、31036 glyph/30890 Unicode，版本/coverage/OFL信息一致。全glyph命令/坐标等价检查失败（400/500分别30806/30805未匹配），保留 `FAILED_OUTLINE_EQUIVALENCE`；不能声称旧VF与静态OTF逐字形完全一致。新参考与原生使用同四份物理字体资产及同SHA，排除了参考两端选用不同字体文件这一类偏差。该检查没有修改字体，未将失败通过放宽轮廓阈值改为通过。

归档不修改原稿内容或成功准入模型。`approved-source/index.html` 等文件保留原始相对引用，只用于来源审计；实际可查看入口为本目录的 `index.html` 与派生 `catalogue.html`。历史页面索引仍是全应用历史草案，不能替代当前三个功能的设计或原生验收。
