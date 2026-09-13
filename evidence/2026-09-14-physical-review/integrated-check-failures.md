# 整合检查发现与处理

1. 首次pipeline在 `test-legado-product-logic.mjs:72` 停止：旧正则锁定仅first-seen排序形状。当前业务要求准确书名优先。现改调用真实生产分组/排序回归，保留同级稳定顺序、迟到准确书前插、源计数更新对象稳定、滚动锚与重挂恢复；未削弱旧语义。
2. 为一次定位后续失败，按原检查清单顺序执行其余203组（不作为替代交付入口）：202通过，SVG来源1项失败。根因是新增6个App主题角色后，SVG_PROVENANCE中165处主题注册表摘要陈旧，实际图形路径/颜色字节未改变。已通过现有sync-svg-assets更新清单，350资产来源校验通过。
3. 整合前源码检查发现AppearanceContent新增ThemeEnd/ThemeScheme两函数缺import。已补真实导入；先前SDK探针注入依赖不能发现此类导入缺失，所以探针通过没有替代完整编译。

以上为当前源码/本地检查的问题，不是本轮新增设备复现。后续pipeline结果另记，不将首次失败删去。

4. 第二次pipeline的232组本地检查全部通过，ArkTS整编在LRE旧书签显示回填的两处对象展开停止（5763/5765，arkts-no-spread）。已按LocalReadingBookmark/LocalReadingTocEntry全部声明字段显式复制，保留笔记、锚、下载/可导航状态；同一生产回填回归再次通过。未把本地通过包装为当时编译通过。
