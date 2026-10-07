# 共同视觉规格参考入口

入口为 `index.html`。它复用用户选定第三版换源稿的原交互模型、阅读/控制栏组件、DOM、封面与阅读基底；换源组件实际加载 `source-switch-reference.css`。动画参数、字体与自适应参数来自 `Reader-UI/design/source-switch/source-switch.visual.json`，同一输入也生成原生 `SourceSwitchVisual.ts` 和小说 Typography 角色。

这是同工作区的薄参考入口：相对路径依赖相邻 `source-switch-design-20261006` worktree，不是可单独移动的归档。没有复制封面、阅读CSS、字体或SVG，也没有修改原稿。`reference-manifest.json` 保存所有依赖路径/hash、派生bundle/hash、公共定义hash及检查边界。

画布外可选原稿、VM、窄宽、短屏或极短窗口配置，也可输入字体倍率与安全边距。宽/短/字体缩放/整页滚动是明确登记的自适应扩展，标准390×844/倍率1保留100高书籍区。原稿文字线框88.1超过其84高内区；参考允许可见溢出，原生在100高外区居中形成对应布局。当前业务定位章节开头，因此只修正切换说明和完成反馈中的阅读位置文案。示例查找与切换仍为模拟，不能作为真实Core/事务/位置恢复证据。

检查命令（在Host根目录）：

```sh
node tools/generate-source-switch-visual.mjs --check
node docs/ui-design/source-switch-reference/build-reference.mjs
node docs/ui-design/source-switch-reference/build-reference.mjs --check
```

构建复用本工作区已有 `esbuild 0.28.2`；没有安装依赖或启动服务。它执行4个自适应参数检查、4个静态模板资源解析、15个模板资产检查，并记录公共CSS/原生输入的一致hash。模板与数学检查不是浏览器渲染。当前 `browserRendered=false`、`browserPlayback=false`、原生视觉验收OPEN。

`font-provenance.json` 保存一次FontTools4.60.2的只读字体检查：VF与UI静态400/500均为Noto版本2.004、31036 glyph/30890 Unicode，版本/coverage/OFL信息一致。全glyph命令/坐标等价检查失败（400/500分别30806/30805未匹配），保留 `FAILED_OUTLINE_EQUIVALENCE`；不能声称旧VF与静态OTF逐字形完全一致。新参考与原生使用同四份物理字体资产及同SHA，排除了参考两端选用不同字体文件这一类偏差。该检查没有修改字体，未将失败通过放宽轮廓阈值改为通过。
