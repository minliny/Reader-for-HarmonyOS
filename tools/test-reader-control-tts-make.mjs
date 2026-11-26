import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={
 'clip-difference':{description:'Pure Timer minus painted Speed clip sets across source/scroll/reversal',resources:[]},
 'quick-vertical-budget':{description:'Actual Phone and Tablet panel budgets fit every Quick TTS row and keep a shortened brightness rail clear of navigation',resources:[]},
 'preset-controls':{description:'Actual SDK timer/rate preset and stepper callbacks, ranges and retained admission',resources:[]}
};
const selected=selectContractCases(definitions);
async function runCase(selectedCase){
const {default:assert}=await import('node:assert/strict');
const { readFileSync }=await import('node:fs');
const geometry=await import('../entry/src/main/ets/features/reading/ui/ReaderControlPlaybackGeometry.ts');
const actors=await import('../entry/src/main/ets/features/reading/ui/ReaderControlActorGeometry.ts');
const paint=await import('../entry/src/main/ets/features/reading/ui/ReaderControlMotionPresentation.ts');
const tts=await import('../entry/src/main/ets/features/reading/application/ReaderTtsState.ts');


if(selectedCase==='quick-vertical-budget'){
const panelGeometry=await import('../entry/src/main/ets/features/reading/ui/ReaderControlGeometry.ts');
const motion=await import('../entry/src/main/ets/features/reading/ui/ReaderControlMotionGeometry.ts');
const {selectedProductionMethods}=await import('./lib/selected-production-methods.mjs');
const Panel=selectedProductionMethods(new URL('../entry/src/main/ets/features/reading/ui/ReaderControlPanel.ets',import.meta.url),
  'ReaderControlPanel',['controlPanelHeight','controlQuickHeight','brightnessTrackHeight','clampBrightness','roundBrightness',
    'commitBrightnessTap','updateBrightnessDrag'],panelGeometry);
function fixture(expanded,width,fullPanelHeight){
  const changes=[];
  const owner=Object.assign(new Panel(),{layout:{fullPanelHeight,quickPanelHeight:Math.min(fullPanelHeight,330)},isExpanded:()=>expanded,
    brightnessDragStartPercent:1,onBrightnessChange:value=>changes.push(value)});
  const bounds=motion.readerControlMotionBounds(width,owner.controlPanelHeight(),19,owner.controlQuickHeight());
  const frame=motion.sampleReaderControlMotionComposition({visibilityProgress:1,expansionProgress:0},bounds);
  owner.frame=()=>frame;
  return {owner,frame,changes};
}
for(const [expanded,width] of [[false,364],[true,720]]){
  const {frame}=fixture(expanded,width,650);
  const quick=geometry.sampleReaderControlTts(0,frame.content.width);
  assert.equal(frame.content.height,quick.contentHeight);
  for(const section of [quick.playback,quick.timer,quick.speed]){
    assert.ok(section.y+section.height<=frame.content.height,'all three authored Quick actors survive the actual host clip');
  }
  assert.ok(frame.content.y+frame.content.height<=frame.navigation.y,'Quick content stays above navigation');
  assert.equal(frame.brightness.height,panelGeometry.READER_CONTROL_BRIGHTNESS_RAIL_HEIGHT);
}
const {owner,frame,changes}=fixture(true,720,260);
assert.ok(frame.brightness.y+frame.brightness.height<=frame.navigation.y,'short rail cannot cover navigation');
const trackHeight=owner.brightnessTrackHeight();
assert.ok(trackHeight>0&&trackHeight<panelGeometry.READER_CONTROL_BRIGHTNESS_TRACK_HEIGHT);
owner.commitBrightnessTap({fingerList:[{localY:trackHeight}]});
owner.commitBrightnessTap({fingerList:[{localY:0}]});
owner.updateBrightnessDrag(-trackHeight);
assert.deepEqual(changes,[1,100,100],'tap and drag share the shortened track endpoints');
const tiny=fixture(true,720,200);
assert.equal(tiny.frame.brightness.opacity,0,'a rail with no usable track takes no input');
tiny.owner.commitBrightnessTap({fingerList:[{localY:0}]});
assert.deepEqual(tiny.changes,[]);

}else if(selectedCase==='clip-difference'){
const inside = (rects, x, y) => rects.some(r => x > r.x && x < r.x + r.width && y > r.y && y < r.y + r.height);
const intersection = (a, b) => Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
let crossed = false, clippedSpeed = false;
// Real source/target clip unions at different scroll anchors. An invisible
// Speed actor must never punch a hole through Timer during reverse/re-grab.
for (const delta of [-24, 0, 120]) for (const offset of [0, 300, 565, 1200]) {
  for (let step = 0; step <= 100; step++) {
    const p = step / 100, width = 286 + 52 * p + delta;
    const current = geometry.sampleReaderControlTts(p, width);
    const full = geometry.sampleReaderControlTts(1, width), quick = geometry.sampleReaderControlTts(0, width);
    const clips = kind => paint.readerControlMotionClipRects(p, full[kind], current[kind], quick[kind], 666, offset);
    const timer = clips('timer'), speed = clips('speed');
    const mapped = speed.map(r => ({ ...r, x: r.x + current.speed.x - current.timer.x, y: r.y + current.speed.y - current.timer.y }));
    const visible = geometry.readerControlTtsTimerVisibleRects(timer, current, speed);
    assert.deepEqual(geometry.readerControlTtsTimerVisibleRects(timer, current, speed), visible, 'sampling is reversible and stateless');
    for (const a of visible) for (const b of mapped) assert.ok(intersection(a, b) < 1e-7, 'no translucent Timer/Speed double painting');
    for (let x = 2.3; x < current.timer.width; x += 19.7) for (let y = 1.7; y < current.timer.height; y += 11.3) {
      assert.equal(inside(visible, x, y), inside(timer, x, y) && !inside(mapped, x, y), 'only actually painted Speed pixels occlude Timer');
    }
    crossed ||= timer.some(a => mapped.some(b => intersection(a, b) > 1));
    if (speed.every(r => r.height === 0)) {
      clippedSpeed = true; assert.deepEqual(visible, timer, 'fully clipped Speed makes no ghost hole');
    }
    if (p === 0 || p === 1) assert.deepEqual(visible, timer, 'both reference endpoints remain uncut');
    if (p === 0) assert.ok(current.quickPlaybackLabel.x + current.quickPlaybackLabel.width < current.previous.x,
      'Quick status and transport do not collide at the smaller host width');
  }
}
assert.ok(crossed && clippedSpeed, 'test covers both real crossing and invisible occluders');


}else{
const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
const source = readFileSync(new URL('../entry/src/main/ets/features/reading/ui/ReaderControlTtsContent.ets', import.meta.url), 'utf8');
const methods = ['p', 'fullInput', 'sharedInput', 'effectiveRate', 'timerSummary', 'timerCaption', 'twoDigits',
  'displayTimerMode', 'displayTimerMinutes', 'displayTimerSeconds', 'displayTimerDigits',
  'timerPresetSelected', 'timerPresetLabel', 'timerPresetIsSelected', 'chooseTimerPreset', 'timerPreset',
  'cycleQuickTimer', 'timerStepper', 'timerStepButton', 'stepTimer',
  'ratePresets', 'ratePresetWidth', 'chooseRatePreset', 'ratePreset',
  'roundControl', 'transport', 'transportResponse', 'transportPaint', 'transportGlyphSize'];
const {readerTypographyRoles}=await import('./lib/reader-typography-probe.mjs');
const {readerAppColor}=await import('../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts');
const {pureModuleProbe}=await import('./lib/ets-pure-module-probe.mjs');
const {productionReaderPressFeedback}=await import('./lib/reader-press-feedback-probe.mjs');
const ReaderPressFeedback=productionReaderPressFeedback({ColorMetrics:{
  resourceColor:color=>({color,blendColor:overlay=>({color:`blend(${color},${overlay.color})`})}),
}});
const accessibility=pureModuleProbe(readFileSync(new URL('../entry/src/main/ets/ui/controls/ReaderActionAccessibility.ets',import.meta.url),'utf8'),'ReaderActionAccessibility.ets',{AccessibilityRoleType:{BUTTON:'button'}},['ReaderActionAccessibility']);
const presetActors=pureModuleProbe(source.slice(0,source.indexOf('@Component')),'ReaderTtsPresetActors.ets',{
  ...accessibility,readerAppColor,ReaderPressFeedback,FrameCallback:class{},Color:{Transparent:'transparent'},
  readerTtsPlayGradientStart: () => '#2F6373',
  ReaderWindowCoordinator:{metrics:()=>({densityPixels:2})},
},['ReaderTtsPresetModifier','ReaderTtsTransportModifier','readerTtsPresetLabelColor']);
const timerLabels=pureModuleProbe(readFileSync(new URL('../entry/src/main/ets/features/reading/ui/ReaderControlTtsMinimum.ets',import.meta.url),'utf8'),
  'ReaderControlTtsMinimum.ets',{},['readerControlTtsTwoDigits','readerControlTtsTimerSummary','readerControlTtsTimerCaption']);
const { owner } = createReaderBuilderProbe(source, methods, { ...geometry, ...actors, ...tts, ...readerTypographyRoles,
  readerAppColor,ReaderPressFeedback,...accessibility,...presetActors,...timerLabels });
const transport = {
  previous: { x: 0, y: 5, width: 44, height: 60 }, toggle: { x: 50, y: 5, width: 70, height: 60 },
  stop: { x: 126, y: 5, width: 60, height: 60 }, next: { x: 192, y: 5, width: 44, height: 60 },
  playback: { x: 0, y: 0, width: 240, height: 70 },
};
Object.assign(owner, { motionProgress: 1, interactionEnabled: true, state: { rate: 1 }, ratePreview: -1,
  timerMode: 'duration', timerMinutes: 25, timerSeconds: 0,
  appScheme: 'day', configField: '', textMinimum: () => undefined,
  displayedFacts: () => undefined,
  currentInputEnabled: () => owner.interactionEnabled,
  frame: () => ({ ...transport, speedPresets: { width: 280 } }),
  isActivelySpeaking: () => false, onlineServicePage: () => false, controlText: kind => kind });
for (const minutes of [0, 15, 30, 45, 60, 'chapterEnd']) owner.timerPreset(minutes);
const presetShadow = [...owner.nodes.values()].find(node=>node.type==='Button'&&node.shadow!==undefined).shadow;
assert.equal(presetShadow.radius,14);
assert.equal(presetShadow.offsetY,4);
owner.timerStepper(true); owner.timerStepper(false);
owner.ratePresets().forEach(rate => owner.ratePreset(rate));
owner.roundControl('toggle');
const mountedCount = owner.observers.length, commands = [];
owner.onTimerChange = (m, s, mode = 'duration') => {
  commands.push(['timer', m, s, mode]); owner.timerMode = mode;
  owner.timerMinutes = m; owner.timerSeconds = s;
};
owner.onRateChange = rate => { commands.push(['rate', rate]); owner.state = { rate }; };
const button = label => [...owner.nodes.values()].find(n => n.accessibilityText === label);
for (const [label, paintHeight, role] of [['定时30分钟', 36, 'TOK_TTS_FIELD'], ['语速1.00倍', 32, 'TOK_TTS_TEAL']]) {
  const target = button(label);
  assert.equal(target.height, paintHeight);
  assert.deepEqual(target.responseRegion, { x: 0, y: (paintHeight - 44) / 2, width: '100%', height: 44 });
  const normal = readerAppColor(role, 'day');
  assert.equal(target.backgroundColor, normal);
  const nodeId = [...owner.nodes].find(([, node]) => node === target)[0];
  const modifier = owner.attributeCalls.find(call => call.id === nodeId && call.property === 'attributeModifier').args[0];
  let pressed;
  const attributes = { backgroundColor(value) { pressed = value; return this; }, borderRadius() { return this; } };
  modifier.applyPressedAttribute(attributes);
  assert.equal(pressed, `blend(${normal},${readerAppColor('app.interaction.press', 'day')})`);
}
const play = button('toggle');
assert.deepEqual([play.width, play.height, play.position], [58, 58, { x: 56, y: 6 }]);
assert.deepEqual(play.responseRegion, { x: -6, y: -1, width: 70, height: 60 }, 'play keeps the paid carrier response');
const start = '#2F6373', end = readerAppColor('TOK_TTS_PLAY_END', 'day');
assert.deepEqual(play.linearGradient.colors, [[start, 0], [end, 1]]);
const playId = [...owner.nodes].find(([, node]) => node === play)[0];
const playModifier = owner.attributeCalls.find(call => call.id === playId && call.property === 'attributeModifier').args[0];
let gradient;
const paintPort = new Proxy({}, { get: (_target, key) => value => { if (key === 'linearGradient') gradient = value; return paintPort; } });
playModifier.applyPressedAttribute(paintPort);
const ink = readerAppColor('app.interaction.press', 'day');
assert.deepEqual(gradient.colors, [[`blend(${start},${ink})`, 0], [`blend(${end},${ink})`, 1]]);
playModifier.applyNormalAttribute(paintPort);
assert.deepEqual(gradient.colors, [[start, 0], [end, 1]]);
for (const p of [0, .2, 1, .8, 1]) {
  owner.motionProgress = p; owner.replay();
  for (const label of ['定时30分钟', '增加五分钟', '语速1.25倍']) {
    const before = commands.length; button(label).onClick();
    assert.equal(commands.length - before, p === 1 ? 1 : 0, 'new controls respect the same input lock during morph');
  }
}
owner.motionProgress = 1; owner.timerMode = 'duration'; owner.timerMinutes = 1; owner.timerSeconds = 20; owner.replay();
button('增加五秒').onClick(); owner.replay(); assert.equal(owner.timerSeconds, 25);
button('减少五秒').onClick(); owner.replay(); assert.equal(owner.timerSeconds, 20);
owner.motionProgress = 1; owner.timerMode = 'duration'; owner.timerMinutes = 180; owner.timerSeconds = 59; owner.replay();
assert.equal(button('增加五分钟').enabled, false); assert.equal(button('增加五秒').enabled, false);
owner.timerMinutes = 0; owner.timerSeconds = 0; owner.replay();
assert.equal(button('减少五分钟').enabled, false); assert.equal(button('减少五秒').enabled, false);
button('朗读到本章结束停止').onClick(); owner.replay();
assert.equal(owner.timerCaption(), '本章结束'); assert.equal(owner.timerMode, 'chapterEnd');
owner.motionProgress = 0; owner.cycleQuickTimer(); assert.equal(owner.timerMode, 'off');
owner.cycleQuickTimer(); assert.equal(owner.timerMinutes, 15); assert.equal(owner.timerMode, 'duration');
owner.cycleQuickTimer(); assert.equal(owner.timerMinutes, 30);
owner.cycleQuickTimer(); assert.equal(owner.timerMinutes, 60);
owner.cycleQuickTimer(); assert.equal(owner.timerMode, 'chapterEnd');
owner.motionProgress = 1; owner.replay();
button('关闭定时停止').onClick(); owner.replay(); assert.equal(owner.timerCaption(), '不开启');
owner.interactionEnabled = false; owner.replay();
const before = commands.length; button('语速1.25倍').onClick(); assert.equal(commands.length, before);
assert.equal(owner.observers.length, mountedCount, 'business changes never remount preset or stepper actors');
for (const [kind, a, b] of commands) {
  if (kind === 'timer') assert.ok(a >= 0 && a <= 180 && b >= 0 && b <= 59);
  else assert.ok(a >= .5 && a <= 2 && Math.abs(a * 20 - Math.round(a * 20)) < 1e-8);
}


}
}
for(const id of selected){await runCase(id);recordContractCasePass(id);}
