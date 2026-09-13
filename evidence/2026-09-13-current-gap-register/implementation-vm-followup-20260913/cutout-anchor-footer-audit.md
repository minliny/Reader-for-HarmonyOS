# 二包刘海切换后正文锚与页码复核

本次仅复用已有VM证据及当前源码，不操作设备、不修改生产代码。

## 初始观察与范围

- 产物：二包 `20260913T144756Z-a91af09f-e06b4393` / Harmony `a91af09f`。
- 文件：同目录 `reader-control-b17f29a4-20260913-{auto-full-paused,auto-stopped,settings-full,cutout-reading}.json` 及实际存在的对应PNG（auto-stopped没有PNG）。
- `settings-full.png` 开关开启前，正文顶端露出章150段06末尾、下接段07；`cutout-reading.png` 开启刘海并隐藏控制后仍是该处文字，底部显示“第2/4页”。settings-full JSON同时出现相邻页的2/4与3/4信息，尚不能仅凭搜索到这些字符串判定当前页码错误。
- 必须结合祖先槽位的bounds/opacity/selected及实际可见画面判断；常驻相邻槽不等于当前展示槽。随后审计viewport重排捕获scalar、页布局缓存键、visiblePage更新、ordinal与footer消费者。

当前不将该观察认定为文本/页码不一致；结论待代码与有效槽位分析后追加。

## 有效槽位和正文逐行核对

原始JSON逐槽摘要与输入SHA256见 `cutout-anchor-footer-observation.json`。

| 场景 | 当前槽a | 相邻槽b | a首行 / 正文有效行数 |
|---|---|---|---|
| auto-full-paused | opacity1，3/4 | opacity0，2/4 | “后页时是否仍然连续。阅读暂停后又继” / 17 |
| auto-stopped | opacity1，3/4 | opacity0，2/4 | 同上 / 17 |
| settings-full | opacity1，3/4 | opacity0，2/4 | 同上 / 17 |
| cutout-reading | opacity1，2/4 | opacity0，2/4 | 同上 / 18 |

`reader-page-slot-a/b`的selected均为false，因此这个通用字段不是当前页选择语义；实际以祖先slot opacity以及可见PNG判定。b内Text各自opacity1不会抵消父级opacity0，不能把它的“第2/4页”当成切换前当前页。

切换前a确为3/4，之后a确为2/4，这次页码变化真实存在。前17个有效正文行文本逐项完全相同，后面仅增加一行“的位置写进册子，用来核对翻到前页和”；不是把b的前页正文切成当前。首行bounds从`[78,300][1202,423]`变为`[78,252][1202,375]`，宽和单行高不变，y上移48px；段07标题同样从y725上移至677。正文已排版区域从`[78,300][1202,2559]`变为`[78,252][1202,2634]`，高度增加123px，恰为一行高度。footer自身bounds始终`[1011,2684][1193,2734]`，变化是文案，不是位置错位。

## 当前生产代码的定义

1. `ReaderLayoutGeometry.ts:232` 的 `resolveReaderReadingLayout` 按刘海开关决定cutout安全区和顶部信息区保留方式；`bodyHeightAfterTitle`用新viewport减去实际内容inset计算容量，开启后可增加容纳行数。
2. `LocalReadingExperience.ets:7397` 的 `commitReaderWindowSettings` 在策略成功且mutation generation仍有效时，对`extendIntoCutout`变化调用`reflowAfterWindowGeometryChange`。`readingLayout():5495`的cache包含cutout布尔值，`windowMetricsLayoutKey():5540`以及`paginationLayoutSignature():4665`包含几何/四边inset，不能用旧几何的页边界冒充新布局。
3. `reflowAfterWindowGeometryChange():3008`失效本书旧分页索引并清draft，进入当前锚的`beginMeasurement():3343`。该方法从`measuringOffset/desiredChapterOffset`启动，只夹到可显示scalar范围，没有按旧页码跳到另一位置；已有正文在新页保存前继续保留。`completeFirstPage():4256`在Core确认相同`chapterOffset == visiblePage.startScalar`后才一起更新desired offset、visiblePage和visibleFragments。这里的保留对象是文字scalar锚，页号不是持久阅读位置。
4. `currentPageTurnRenderPage():2681`为同一`visiblePage.startScalar`及`visibleFragments`生成page-owned chrome，未从相邻b槽或可变全局页号取footer。`pageChromePaginationKey():5649`使用当前layoutSignature；`pageChromeOrdinal():5665`查`ReadingPaginationIndex.findContainingPage(key, pageStartScalar)`，取该锚在**当前布局canonical分页**中所在的页索引，总数取同key的last page。`ReaderPageChromeModel.ts:59`只做index+1格式化。
5. `ReadingPaginationIndex.ts:291`明确允许任意scalar锚，返回包含该锚的页，而非要求锚等于该canonical页起点。窗口重排保留旧文字锚时，页高增加可能使原第三页起点落入新第二页；此时保留正文首行并显示2/4符合当前实现的页号语义。总数仍为4也不矛盾：前几页分界变化不要求整章总页数一定变化。`bookTurnTextureIdentity():2781`包含布局签名及footer字符串，页码更新亦会更新纹理身份，不是旧Native纹理应继续保留3/4的路径。

本地执行实际`pageChromeOrdinal`方法和实际`ReadingPaginationIndex`作语义核对：同一scalar200，在页起点`[0,100,200,300]`为3/4；失效旧索引并录入新布局`[0,110,220,330]`后为2/4，旧key无结果。日志 `cutout-ordinal-policy.log`。这是明确标识的合成边界例，证明生产方法语义，不把这些数字冒充本次VM实际页起点。

## 结论与剩余边界

本次证据支持**刘海开启后保留文字锚、增加一行容量，并按新布局重新计页**，未发现正文跳错页、误读隐藏相邻槽或footer混用其他页数据的已定位缺陷。当前无需为此修改生产代码，也不新增产品待决。

有效布局没有导出本次新canonical页起点数组，因此不能声称已逐scalar独立算出本书每个新分界；这一限制不等于已有页码错误。现有画面和源码可以解释3/4→2/4，不能仅因页号变化反推阅读锚丢失。此记录不代替完整窗口变化/翻页/用户视觉验收，也未调用HDC、Git或修改生产/测试。
