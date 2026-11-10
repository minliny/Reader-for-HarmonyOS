import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={
 'shared-layout':{description:'Current ReaderControlGeometry/owner layout values consumed by shared panel',resources:[]},
 'input-bounds':{description:'Current progress/brightness/TTS public input bounds',resources:[]}
};
const selected=selectContractCases(definitions);
async function runCase(selectedCase){
const {default:assert}=await import('node:assert/strict');

const {
  ReaderControlGeometry,
  READER_CONTROL_BRIGHTNESS_MAX,
  READER_CONTROL_BRIGHTNESS_MIN,
  READER_CONTROL_BRIGHTNESS_RAIL_HEIGHT,
  READER_CONTROL_CONTENT_SLOT_HEIGHT,
  READER_CONTROL_FULL_TTS_BOTTOM_GAP,
  READER_CONTROL_HOME_CHAPTER_PROGRESS_HEIGHT,
  READER_CONTROL_HOME_QUICK_ACTION_HEIGHT,
  READER_CONTROL_HOME_SECTION_GAP,
  READER_CONTROL_HOME_TOP_ROW_HEIGHT,
  READER_CONTROL_PROGRESS_MAX,
  READER_CONTROL_PROGRESS_MIN,
  READER_CONTROL_PROGRESS_STEP,
  READER_CONTROL_REGULAR_DOCK_HEIGHT,
}=await import('../entry/src/main/ets/features/reading/ui/ReaderControlGeometry.ts');
const {
  READER_FULL_PANEL_TOP,
  resolveReaderControlLayout,
}=await import('../entry/src/main/ets/features/reading/ui/ReaderLayoutGeometry.ts');
const {
  createDefaultReaderWindowMetrics,
}=await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
const {
  READER_TTS_RATE_MAX,
  READER_TTS_RATE_MIN,
  READER_TTS_RATE_STEP,
  READER_TTS_RATE_STEP_SCALE,
  READER_TTS_TIMER_MAX_MINUTES,
  READER_TTS_TIMER_MAX_SECONDS,
  READER_TTS_TIMER_MIN,
}=await import('../entry/src/main/ets/features/reading/application/ReaderTtsState.ts');

if(selectedCase==='shared-layout'){
const phoneLayout = resolveReaderControlLayout(390, 844, false, createDefaultReaderWindowMetrics());
const tabletLayout = resolveReaderControlLayout(760, 960, true, createDefaultReaderWindowMetrics());
assert.equal(phoneLayout.topBarTop, 19);
assert.equal(READER_FULL_PANEL_TOP, 88);
assert.equal(phoneLayout.fullPanelTop, READER_FULL_PANEL_TOP);
const shortTabletLayout = resolveReaderControlLayout(1080, 800, true, createDefaultReaderWindowMetrics());
assert.equal(shortTabletLayout.viewportHeight - shortTabletLayout.dockBottomGap - shortTabletLayout.fullPanelHeight,
  shortTabletLayout.fullPanelTop, 'the expanded sheet respects its top budget at the actual dock anchor');
const measuredPhone = createDefaultReaderWindowMetrics();
measuredPhone.densityPixels = 2;
measuredPhone.statusBarHeight = 39;
measuredPhone.gestureInsets.bottom = 28;
const baseline = resolveReaderControlLayout(390, 844, false, measuredPhone);
assert.deepEqual([baseline.fullPanelWidth, baseline.quickPanelHeight, baseline.fullPanelHeight], [364, 330, 705]);
for (const [width, height] of [[360, 800], [390, 844], [430, 932]]) {
  const layout = resolveReaderControlLayout(width, height, false, measuredPhone);
  const {fullPanelWidth:panelWidth,quickPanelHeight:quick,fullPanelHeight:full} = layout;
  assert.ok(panelWidth >= width * 0.91 && panelWidth <= width * 0.96);
  assert.ok(quick >= height * 0.37 && quick <= height * 0.42);
  assert.ok(full >= height * 0.8 && full <= height * 0.87);
  assert.ok(panelWidth / quick >= 1.05 && panelWidth / quick <= 1.15);
  assert.ok(panelWidth / full >= 0.49 && panelWidth / full <= 0.55);
  assert.ok(height - layout.dockBottomGap - full >= layout.fullPanelTop);
  assert.equal(panelWidth * measuredPhone.densityPixels, Math.round(panelWidth * measuredPhone.densityPixels));
}
assert.equal(READER_CONTROL_REGULAR_DOCK_HEIGHT, 330);
assert.equal(READER_CONTROL_CONTENT_SLOT_HEIGHT, 196);
assert.equal(READER_CONTROL_HOME_TOP_ROW_HEIGHT, 190);
assert.equal(READER_CONTROL_BRIGHTNESS_RAIL_HEIGHT, READER_CONTROL_HOME_TOP_ROW_HEIGHT,
  'home quick controls and brightness rail share the parent-owned height constraint');
assert.equal(READER_CONTROL_HOME_QUICK_ACTION_HEIGHT + READER_CONTROL_HOME_SECTION_GAP +
  READER_CONTROL_HOME_CHAPTER_PROGRESS_HEIGHT, 190.001,
  'the named Figma rounding adjustment must preserve the current exported child heights');
assert.equal(READER_CONTROL_FULL_TTS_BOTTOM_GAP, 19,
  'Full TTS keeps its own semantic anchor even while its value equals the Phone dock gap');

const phone = new ReaderControlGeometry(false);
const tablet = new ReaderControlGeometry(true);
assert.deepEqual({ ...phone }, {
  sheetH: 330,
  sheetRadiusBottom: 24,
  moduleNavH: 80,
  moduleNavBottomGap: 14,
  moduleNavRadiusTop: 12,
});
assert.deepEqual({ ...tablet }, {
  sheetH: READER_CONTROL_REGULAR_DOCK_HEIGHT,
  sheetRadiusBottom: 0,
  moduleNavH: 79,
  moduleNavBottomGap: 0,
  moduleNavRadiusTop: 0,
});


}else{
assert.equal(READER_CONTROL_PROGRESS_MIN, 0);
assert.equal(READER_CONTROL_PROGRESS_MAX, 100);
assert.equal(READER_CONTROL_PROGRESS_STEP, 0.1);
assert.equal(READER_CONTROL_BRIGHTNESS_MIN, 1);
assert.equal(READER_CONTROL_BRIGHTNESS_MAX, 100);
assert.equal(READER_TTS_RATE_MIN, 0.5);
assert.equal(READER_TTS_RATE_MAX, 2);
assert.equal(READER_TTS_RATE_STEP, 0.05);
assert.equal(READER_TTS_RATE_STEP_SCALE, 20);
assert.equal(READER_TTS_TIMER_MIN, 0);
assert.equal(READER_TTS_TIMER_MAX_MINUTES, 180);
assert.equal(READER_TTS_TIMER_MAX_SECONDS, 59);


}
}
for(const id of selected){await runCase(id);recordContractCasePass(id);}
