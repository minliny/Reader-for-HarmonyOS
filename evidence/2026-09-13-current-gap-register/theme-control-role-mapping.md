# 控制层主题消费者映射候选与胶囊精确 actor 清单

2026-09-13，只读审计当前工作树及已保存的 live Figma 返回。本附录没有改变生产代码或设计。**Day 列是当前源码事实；Night 列除标注直接复用者外，全部是实施候选，不是 Figma 已确认的控制层成套夜间设计。**

## 1. 四场景各12个实际动画 actor

完整名称与节点 ID 来自 capsule-figma-live.json；顺序按原始返回。C 场景额外的 Review title / Review timing / Review rule 三个审视说明文字明确不进入产品。

|序号|C 快捷自动|D 快捷TTS|E 完整自动|F 完整TTS|
|---|---|---|---|---|
|1|ImmersiveInfo · incoming (`1308:3112`)|ImmersiveInfo · incoming (`1353:3297`)|ImmersiveInfo · incoming (`1392:4021`)|ImmersiveInfo · incoming (`1392:5033`)|
|2|PageLabel · incoming (`1308:3235`)|PageLabel · incoming (`1353:3298`)|PageLabel · incoming (`1392:4022`)|PageLabel · incoming (`1392:5034`)|
|3|TopBar · outgoing (`1308:3154`)|TopBar · outgoing (`1353:3299`)|TopBar · outgoing (`1392:4023`)|TopBar · outgoing (`1392:5035`)|
|4|DockShell · outgoing · panel detached (`1308:3181`)|DockShell · outgoing · panel detached (`1353:3300`)|FullPanel · AutoPage · outgoing (`1392:4024`)|FullPanel · TTS · outgoing (`1392:5036`)|
|5|TriggerMorphProxy · AutoPagePanel → SessionCapsule (`1308:3236`)|TriggerMorphProxy · TTSPanel → SessionCapsule (`1353:3304`)|TriggerMorphProxy · AutoPagePlaybackModule → SessionCapsule (`1392:4862`)|TriggerMorphProxy · TTSPlaybackModule → SessionCapsule (`1392:5053`)|
|6|MorphSurface · canonical capsule shell (`1333:3284`)|MorphSurface · canonical TTS capsule shell (`1353:3305`)|MorphSurface · canonical capsule shell (`1392:4863`)|MorphSurface · canonical TTS capsule shell (`1392:5054`)|
|7|SourceRegion · AutoPagePanel · true-scale background + content (`1408:14834`)|SourceRegion · TTSPanel · true-scale background + content (`1353:3307`)|SourceRegion · AutoPage playback module · true-scale background + content (`1392:4864`)|SourceRegion · TTS playback module · true-scale background + content (`1392:5055`)|
|8|AutoPagePanel · sharp uniform-scale (`1308:3237`)|TTSPanel · sharp uniform-scale (`1353:3308`)|PlaybackModuleContent · AutoPage · true uniform scale (`1392:5406`)|PlaybackModuleContent · TTS · true uniform scale (`1392:5911`)|
|9|AutoPagePanel · blurred transition (`1422:15558`)|TTSPanel · blurred transition (`1424:4291`)|PlaybackModuleContent · AutoPage · blurred transition (`1406:4040`)|PlaybackModuleContent · TTS · blurred transition (`1406:4163`)|
|10|CapsuleContent · reveal clip (`1333:3285`)|CapsuleContent · TTS reveal clip (`1353:3310`)|CapsuleContent · AutoPage · reveal-left (`1392:4868`)|CapsuleContent · TTS · reveal-left (`1392:5059`)|
|11|CapsuleTransitionContent · AutoPage · persistent reveal (`1448:4139`)|CapsuleTransitionContent · TTS · persistent reveal (`1467:513`)|CapsuleTransitionContent · AutoPage Full · persistent reveal (`1469:186`)|CapsuleTransitionContent · TTS Full · persistent reveal (`1470:231`)|
|12|CircleState · Pause (`1430:15120`)|CircleState · TTS Pause · persistent fixed (`1467:528`)|CircleState · AutoPage Full Pause · persistent fixed (`1469:201`)|CircleState · TTS Full Pause · persistent fixed (`1470:246`)|

12个actor中，TriggerMorphProxy 是稳定几何父容器；SourceRegion 与 MorphSurface 是独立表面；sharp/blur 都必须有独立 translate、scale、opacity，revealClip 与 leading内容分离，pauseCircle 独立固定右缘。PageLabel除自己的位移还具有100–500ms opacity。不能仅数视觉内容而漏掉父容器。

## 2. Night 基础角色及编码

下表统一使用 ArkUI **#AARRGGBB**；六位值视作FF前缀。候选只换RGB并保留对应消费者当前alpha，motion opacity另乘，不能覆盖成颜色alpha。当前Day E6与Figma E5量化差异不在本次迁移中悄悄修正。

|简称|现有Figma Night来源|RGB|
|---|---|---|
|N.surface|color/runtime/surface|#2A2622|
|N.bright|color/runtime/paper/bright|#2C2824|
|N.paper|color/runtime/paper|#24211E|
|N.solid|color/runtime/paper/solid|#1C1A18|
|N.ink|color/runtime/ink|#EADFCE|
|N.muted|color/runtime/muted|#BAAD9C|
|N.line|color/runtime/border|#E2D1B9|
|N.primary|color/runtime/primary|#D2BD96|
|N.primaryDark|color/runtime/primary/dark|#7A684F|
|N.warning|color/settings/status-warn|#DC9E53|
|N.switchOff|color/settings/switch-off|#5C6065|

控制/朗读主色角色保持独立的键，不合并成一个全局primary；下表暂用已有Night primary RGB作为可执行候选。Day的teal/clay/绿色差别原样保留，Night同值候选不是要求抹平Day，也不是Figma已经定好的Night局部主色。

## 3. TOK_READ 全部颜色：按消费者拆归属

来源：entry/src/main/ets/features/common/ReaderTokens.ets；不能因为名字含READ就一律归阅读主题。

|Token/使用场景|当前Day事实|目标角色/ Night候选|边界|
|---|---|---|---|
|TOK_READ_INK（控制层）|#332C25|app.control.ink = N.ink → #FFEADFCE|控制标题、正文说明、胶囊文字|
|TOK_READ_BODY_INK（正文）|#2B241D|reader.body.ink → 当前选中的阅读主题ink|不跟App改色|
|TOK_READ_BODY_INK（目录/候选行）|#2B241D|app.control.itemInk = N.ink → #FFEADFCE|与正文消费者拆分，不能全局替换|
|TOK_READ_MUTED|#5B5046|app.control.muted = N.muted → #FFBAAD9C||
|TOK_READ_UNREAD|#8A7D6E|app.directory.unread = N.muted → #FFBAAD9C|已读/当前/未读仍是独立角色|
|TOK_READ_PRIMARY|#2F6373|app.control.primary = N.primary → #FFD2BD96|候选；键与app.primary独立|
|TOK_READ_ICON|#4D463F|app.control.icon = N.ink → #FFEADFCE|不修改SVG path|
|TOK_READ_HANDLE|#B9AD9F|app.control.handle = N.muted → #FFBAAD9C||
|TOK_READ_ACTIVE_SOFT|#142F6373|app.control.activeSoft = N.primary/14 → #14D2BD96|alpha14保留|
|TOK_READ_DISABLED_BG|#8FEEE6DB|app.control.disabledSurface = N.bright/8F → #8F2C2824|disabled文字单独角色|
|TOK_READ_SURFACE|#FAFFFAF4|app.control.surface = N.surface/FA → #FA2A2622|外壳与顶栏98%保留|
|TOK_READ_ELEVATED|#BDFFFCF8|app.control.elevated = N.bright/BD → #BD2C2824||
|TOK_READ_IMMERSIVE_META|#766C61|reader.chrome.meta(day) = #766C61|保持阅读归属|
|TOK_READ_IMMERSIVE_META_NIGHT|#C8C0B4|reader.chrome.meta(night) = #C8C0B4|保持阅读归属；不换N.muted|

## 4. TOK_TTS 全部18项与动态渐变

来源：entry/src/main/ets/features/reading/ReaderControlTtsStyle.ts（Make v17定义）；所有TTS控制表面归App，正文朗读高亮另归Reader。

|Token/消费者|当前Day事实|Night候选（AARRGGBB）|映射说明|
|---|---|---|---|
|TOK_TTS_INK|#332C25|#FFEADFCE|N.ink|
|TOK_TTS_MUTED|#8A7D6F|#FFBAAD9C|N.muted|
|TOK_TTS_TEAL|#2F6373|#FFD2BD96|N.primary，独立tts.primary键|
|TOK_TTS_TEAL_SOFT|#1C2F6373|#1CD2BD96|N.primary+1C|
|TOK_TTS_TEAL_LINE|#382F6373|#38D2BD96|N.primary+38|
|TOK_TTS_PLAY_START|#357487|#FFD2BD96|N.primary；保留渐变与Quick/Full进度映射|
|TOK_TTS_PLAY_END|#244F5C|#FF7A684F|N.primaryDark|
|TOK_TTS_CLAY|#A8543A|#FFDC9E53|N.warning；独立tts.clay键，候选|
|TOK_TTS_CLAY_SOFT|#1CA8543A|#1CDC9E53|同clay RGB+1C|
|TOK_TTS_CLAY_LINE|#5CA8543A|#5CDC9E53|同clay RGB+5C|
|TOK_TTS_PAPER（表面）|#FFFCF8|#FF2A2622|N.surface，需拆token混用|
|TOK_TTS_PAPER_START|#FFFCF7|#FF2C2824|N.bright|
|TOK_TTS_PAPER_END|#F6F0E6|#FF24211E|N.paper|
|TOK_TTS_CARD|#EBFFFCF8|#EB2A2622|N.surface+EB|
|TOK_TTS_QUICK_CARD|#B8FFFCF8|#B82A2622|N.surface+B8|
|TOK_TTS_LINE|#57B4A697|#57E2D1B9|N.line+57|
|TOK_TTS_FIELD|#24B4A697|#24E2D1B9|当前实际是低alpha轨道/字段着色，不能换成实色面板|
|TOK_TTS_TRACK|#47B4A697|#47E2D1B9|N.line+47|

**TOK_TTS_PAPER 当前跨角色复用必须拆开**：ReaderControlTtsContent的timerPreset/rate已选文字应变app.tts.onPrimary，Night候选#FF1C1A18（N.solid）；Slider/Switch thumb应变app.tts.thumb，Night候选#FFEADFCE（N.ink）；容器表面才用#FF2A2622。不能把所有PAPER消费者一次替换为深色，导致文字和滑块消失。当前#FFFAF4用于控制primary上的文字同样分成app.control.onPrimary，Night候选#FF1C1A18；Figma runtime/on/primary的白色常量本身仍保留，只有实际浅色填充上的消费者单独映射并核对。

readerTtsPlayGradientStart(p)的Day保留#357487→#2F6373。Night候选两个端点均引用已登记tts.playStart/tts.primary（当前候选都为#D2BD96），p仍由同一progress采样；渐变终点#7A684F独立保留。后续如为Night核对出不同Quick主色，只改注册表端点，禁止在组件重写插值常量。

## 5. ControlThemeStyle、共享表面与描边消费者

当前ReaderControlThemeStyle七字段必须扩大为实际消费者的完整对象；不能只让这七字段动态然后留下其余TOK/裸色。

|消费者角色/现有Token|当前Day|Night候选|来源规则|
|---|---|---|---|
|ink / TOK_READ_INK|#332C25|#FFEADFCE|N.ink|
|muted / TOK_READ_MUTED|#5B5046|#FFBAAD9C|N.muted|
|primary / TOK_READ_PRIMARY|#2F6373|#FFD2BD96|N.primary|
|panel / TOK_SURFACE_PANEL|#9EFFFCF8|#9E2A2622|N.surface+9E|
|panelSoft / TOK_SURFACE_PANEL_SOFT|#A3EEE6DB|#A32C2824|N.bright+A3|
|line / TOK_LINE|#2E9B8466|#2EE2D1B9|N.line+2E|
|lineStrong / TOK_LINE_STRONG|#57B4A697|#57E2D1B9|N.line+57|
|TOK_CARD_BG|#E6FFFCF8|#E62A2622|现有E6保留，不改Figma E5|
|TOK_CARD_BG_HI|#EBFFFCF8|#EB2A2622|N.surface+EB|
|TOK_SURFACE_ELEVATED|#C7FFFFFF|#C72C2824|N.bright+C7|
|TOK_SURFACE_FIELD|#C7FFF8EF|#C72C2824|N.bright+C7|
|TOK_SURFACE_SOLID_OPAQUE|#FAFFFCF8|#FA2A2622|N.surface+FA|
|TOK_SURFACE_SOLID|#FFFCF8|#FF2A2622|保持100%|
|TOK_SURFACE_TRANSLUCENT|#6BFFFCF8|#6B2A2622|N.surface+6B|
|TOK_FIELD_SURFACE|#D1FFF8EF|#D12C2824|N.bright+D1|
|TOK_PRIMARY_BG|#1F2D4A3E|#1FD2BD96|N.primary+1F|
|TOK_PRIMARY_STRONG|#472D4A3E|#47D2BD96|N.primary+47|
|TOK_PRIMARY_SOFT|#172D4A3E|#17D2BD96|N.primary+17|
|TOK_PRIMARY_BORDER|#6B2D4A3E|#6BD2BD96|N.primary+6B|
|TOK_LINE_HARD|#66BEAE9C|#66E2D1B9|N.line+66|
|TOK_BORDER|#C1C7CD|#FFE2D1B9|复用Night border RGB，消费者原FF保留；Figma变量本身33单独留存，不能擅改此消费者alpha|
|TOK_CONTROL_INK|#41484C|#FFEADFCE|N.ink|
|TOK_ON_PRIMARY（控制填充上的文字）|#FFFAF4|#FF1C1A18|独立onControlPrimary候选；不全局覆盖常量|

## 6. 控制组件局部裸色：逐组落到角色，保留原alpha

扫描范围：ReaderControl*.ets、ReaderControlAppearanceStyle.ts、ReaderAutoPageFullPanel.ets、ReaderTtsFullPanel.ets、ReaderTtsConfigOverlay.ets、ReaderSessionCapsule.ets。色值相同但语义不同必须分别映射，不能做全局字符串替换。

|现有消费者/Day值|目标Night候选|约束|
|---|---|---|
|Appearance布局表面#E0FFF9F2 / 边框#429B8466 / caption#807366|#E02C2824 / #42E2D1B9 / #FFBAAD9C|主题swatch色是阅读主题预览，不随App反色|
|Appearance边框#339B8466、白色卡#FFFCF8|#33E2D1B9、#FF2A2622|#FFFAF4若为选中前景改onControlPrimary，不按卡面处理|
|TTS配置/卡面渐变#FFFAF4→#F6ECDD；配置实底#FFFAF4|#FF2C2824→#FF24211E；#FF2A2622|角度、alpha、圆角原样|
|TTS输入框#CCFFF8EF；服务未选底#99FFF8EF|#CC2C2824；#992C2824|字段与卡片分开|
|TTS服务卡#B8FFFCF8；当前#B3ACA4/#C6BFB2/#B4A697的off track|#B82A2622；#FF5C6065|off/disabled/placeholder不能混同；placeholder用N.muted|
|#5B5046/#8A7D6F/#756F69说明，#332C25/#41484C正文，#B4A697 placeholder|#FFBAAD9C；#FFEADFCE；#FFBAAD9C|保留各字号/强度，不借主题改排版|
|teal软底/线/阴影：#122F6373/#172F6373/#1A2F6373/#212F6373/#472F6373/#4D2F6373/#5C2F6373|#12D2BD96/#17D2BD96/#1AD2BD96/#21D2BD96/#47D2BD96/#4DD2BD96/#5CD2BD96|相同RGB角色，原alpha逐项保留；阴影geometry不变|
|线#299B8466/#2E9B8466/#66B4A697；取消底#29B4A697|#29E2D1B9/#2EE2D1B9/#66E2D1B9；#29E2D1B9|取消底是表面状态独立键|
|TTS局部clay错误#A8543A|#FFDC9E53|与TOK_TTS_CLAY同候选；实际错误语义需区分danger，不改业务状态|
|AutoPage危险文字#8C3D36；TTS错误#B93D35、停止#D7473E|原值保留，录入各自danger语义键|语义常量，不因同值强改；对比度失败需记录具体组合|
|TTS旧绿色#1F3528/#2D4A3E、toggle#254A3D|#FF7A684F/#FFD2BD96；#FFD2BD96|旧实现保留Day局部差异，Night为独立角色候选|
|SwitchTrack off #AAA39A；Replace禁用#C9C5BE|#FF5C6065；#FF5C6065|保留state，不让disabled=active|
|Replace白色#FFFFFF；TTS白色高光#99FFFFFF/#33FFFFFF|thumb前景#FFEADFCE；高光保留#99FFFFFF/#33FFFFFF|按实际thumb/surface/highlight拆，白色高光不是浅色卡面|
|配置scrim#661F1B17；shadow#471F1B17/#381F1B17；thumb shadow#382F2314；capsule shadow#12463423|当前值原样保留|semantic阴影/遮罩常量，独立effects角色；不改radius/offset|

胶囊sourceSharp/sourceBlur/sourceSurface/canonicalSurface/leading/pause的所有颜色必须来自同一个App快照，不能source用Reader而canonical用App；footer和沉浸meta保留Reader。暂停圆内icon须用onControlPrimary（Night候选#1C1A18），不是固定白色。

## 7. 完整性与实施门禁

1. 本附录覆盖当前13个TOK_READ颜色（BODY_INK分消费者）、18个TOK_TTS颜色、动态渐变、7个ControlThemeStyle字段以及所列控制组件扫描命中的局部颜色。READ正文/meta明确不迁App。
2. token→semantic role必须按消费位置映射；PAPER、BODY_INK、onPrimary、thumb、白色高光的混用先拆角色。扫描文件/绑定清单应纳入校验，新增裸色导致失败。
3. 全部Day输出保持当前实际值（含E6/FA/BD/B8/EB等alpha），Night值带来源与candidate标识；88项Figma变量不等于这里所有控制角色已获设计确认。
4. 可复用Night基础RGB，不能把其alpha再与原alpha重复相乘。表面alpha和motion opacity分别处理；SVG固定色只换paint，不改路径。
5. Night亮色primary上的前景候选为N.solid，Slider thumb候选N.ink；必须对前景/实际合成背景逐对核验。语义常量失败记具体案例，不批量反色。
6. 候选映射产生可审阅的两App×各控制模块样张后核对；代码生成与角色覆盖可先落地，不能把候选称作已经用户视觉验收。
