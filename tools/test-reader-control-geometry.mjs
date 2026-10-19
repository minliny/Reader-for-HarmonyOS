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
}=await import('../entry/src/main/ets/features/reading/ReaderControlGeometry.ts');
const {
  READER_FULL_PANEL_TOP,
  resolveReaderControlLayout,
}=await import('../entry/src/main/ets/features/reading/ReaderLayoutGeometry.ts');
const {
  createDefaultReaderWindowMetrics,
}=await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
const {
  READER_TTS_RATE_MAX,
  READER_TTS_RATE_MIN,
  READER_TTS_RATE_STEP,
  READER_TTS_RATE_STEP_SCALE,
  READER_TTS_TIMER_MAX_MINUTES,
  READER_TTS_TIMER_MAX_SECONDS,
  READER_TTS_TIMER_MIN,
}=await import('../entry/src/main/ets/features/reading/ReaderTtsState.ts');

if(selectedCase==='shared-layout'){
const phoneLayout = resolveReaderControlLayout(390, 844, false, createDefaultReaderWindowMetrics());
const tabletLayout = resolveReaderControlLayout(760, 960, true, createDefaultReaderWindowMetrics());
assert.equal(phoneLayout.topBarTop, 19);
assert.equal(READER_FULL_PANEL_TOP, 88);
assert.equal(phoneLayout.fullPanelTop, READER_FULL_PANEL_TOP);
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
  sheetH: 252,
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
