import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { SearchViewState } from '../entry/src/main/ets/features/search/SearchViewState.ts';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';

const source = readFileSync(process.env.READER_SEARCH_PAGE_SOURCE ??
  new URL('../entry/src/main/ets/features/search/SearchPage.ets', import.meta.url), 'utf8');
// StateContent branches reference the page's other real Builders; register
// their production names with the same SDK registry without executing them.
const require = createRequire(import.meta.url);
const sdkRoot = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const { CUSTOM_BUILDER_METHOD } = require(`${sdkRoot}/lib/component_map.js`);
for (const match of source.matchAll(/@Builder\s+(?:private\s+)?(\w+)\s*\(/g)) CUSTOM_BUILDER_METHOD.add(match[1]);
const enumValues = name => new Proxy({}, { get: (_, key) => `${name}.${String(key)}` });
const results = [];
function check(name, fn) {
  try { fn(); results.push({ name, status: 'PASS' }); }
  catch (error) { results.push({ name, status: 'FAIL', message: error.message }); }
}
function fixture(history, { width = 0, tablet = false, expanded = false, measureVp = text => text.length * 13 } = {}) {
  let owner;
  const measurements = [];
  // Flex is only a native attribute recorder. The SDK transforms the actual
  // production Builder/ForEach/If; this is not a native layout simulation.
  const Flex = new Proxy({ name: 'Flex' }, { get(target, property) {
    if (property === 'name') return target.name;
    return (...args) => {
      if (property === 'pop') return;
      const node = owner.nodes.get(owner.observers.length - 1);
      node[property] = args.length === 1 ? args[0] : args;
    };
  } });
  ({ owner } = createReaderBuilderProbe(source,
    ['stateContent', 'initialContent', 'refreshVisibleResults', 'publishVisibleGroups'],
    { Flex, FlexWrap: enumValues('FlexWrap'), FlexDirection: enumValues('FlexDirection'),
      FlexAlign: enumValues('FlexAlign'), TOK_BORDER_W: 1, TOK_SPACE_XS: 8,
      TOK_SPACE_CARD_PADDING: 12, TOK_SPACE_ROW_BLOCK: 4 }));
  Object.assign(owner, {
    presentation: { kind: 'initial', history }, isTablet: tablet,
    historyWidth: width,
    viewState: new SearchViewState(),
    viewStateRevision: -1, appThemeScheme: 'day',
    visibleStart: 0, visibleEnd: 0, warmupGroups: [], onVisibleGroups(groups) {
      assert.deepEqual(groups, [], 'history view cannot admit online candidate preparation');
    },
    resultDataSource: { replace() {} },
    getUIContext: () => ({ getMeasureUtils: () => ({ measureTextSize: input => {
      measurements.push(input); return { width: measureVp(input.textContent) * 3.5 };
    } }), px2vp: pixels => pixels / 3.5 }),
  });
  owner.refreshVisibleResults();
  owner.stateContent();
  return { owner, measurements, nodes: () => [...owner.nodes.values()],
    areas: () => [...owner.nodes.values()].filter(node => typeof node.onAreaChange === 'function') };
}
function dispatchArea(f, outerWidth) {
  const areas = f.areas();
  assert.equal(areas.length, 1, 'one authoritative measured history container');
  assert.equal(areas[0].type, 'Column', 'measure the stable history container, not count-dependent empty Flex');
  areas[0].onAreaChange({ width: 0 }, { width: outerWidth });
}
function replayHistory(f) {
  // Retain the SDK-produced ForEach closure and refresh only its data list.
  const each = f.nodes().find(node => node.type === 'ForEach');
  assert.ok(each);
  f.owner.runObserver(each.id, false);
}

check('initial history Scroll uses the top of the content viewport', () => {
  const f = fixture(['唯一历史']);
  assert.equal(f.nodes().find(node => node.type === 'Scroll').align, 'Alignment.TopStart');
  assert.equal(f.areas()[0].padding.top, 8, 'PH62 history uses one existing spacing token below input, not 28vp');
});
check('all history appears before layout without per-item measurement or expansion', () => {
  const history=Array.from({length:35},(_,i)=>`书${i}`);
  const f=fixture(history);assert.equal(f.owner.historyWidth,0);
  for(const keyword of history)assert.ok(f.nodes().some(n=>n.type==='Text'&&n.create===keyword));
  assert.equal(f.measurements.length,0);
  assert.ok(!f.nodes().some(n=>/展开|收起/.test(String(n.create??''))));
  dispatchArea(f,196);replayHistory(f);
  assert.equal(f.measurements.length,0);
  for(const keyword of history)assert.ok(f.nodes().some(n=>n.type==='Text'&&n.create===keyword));
});
check('async history and narrow/tablet widths preserve every entry and existing scroll',()=>{
  for(const tablet of [false,true]) {
    const f=fixture([],{tablet});dispatchArea(f,260);
    f.owner.presentation={kind:'initial',history:['加载后历史','很长'.repeat(80)]};
    f.owner.refreshVisibleResults();f.owner.stateContent();
    assert.equal(f.owner.historyWidth,260-(tablet?40:36));assert.equal(f.measurements.length,0);
    assert.ok(f.nodes().some(n=>n.type==='Text'&&n.create==='加载后历史'));
    assert.equal(f.nodes().find(n=>n.type==='Scroll').align,'Alignment.TopStart');
  }
});
check('fresh-entry focus is consumed once and reset/return cannot recreate it',()=>{
  const state=new SearchViewState();assert.equal(state.consumeInputFocusRequest(),false);
  state.requestInputFocus();assert.equal(state.consumeInputFocusRequest(),true);assert.equal(state.consumeInputFocusRequest(),false);
  state.reset('新查询');assert.equal(state.consumeInputFocusRequest(),false);
  state.requestInputFocus();state.reset();assert.equal(state.consumeInputFocusRequest(),false);
});
check('native focus waits for layout and a removed or returning page never steals it',()=>{
  const path=new URL('../entry/src/main/ets/features/common/ReaderSearchField.ets',import.meta.url);
  const frames=[],focus=[];
  const Field=productionMotionMethods(path,['aboutToAppear','aboutToDisappear'],{
    ReaderSearchFocusFrame:class{constructor(action){this.action=action;}onIdle(){this.action();}}});
  const owner=Object.assign(new Field(),{mounted:false,focusGeneration:0,variant:'bookPage',mode:'submit',focusOnAppear:true,
    getUIContext:()=>({postFrameCallback:frame=>frames.push(frame),getFocusController:()=>({requestFocus:id=>focus.push(id)})})});
  owner.aboutToAppear();assert.equal(focus.length,0);frames.shift().onIdle();assert.deepEqual(focus,['reader-book-search-input']);
  owner.aboutToAppear();owner.aboutToDisappear();frames.shift().onIdle();assert.equal(focus.length,1);
  owner.focusOnAppear=false;owner.aboutToAppear();assert.equal(frames.length,0);
  const fieldSource=readFileSync(path,'utf8');assert.match(fieldSource,/\.enableKeyboardOnFocus\(true\)/);
  assert.match(source,/focusInputOnAppear = this\.viewState\.consumeInputFocusRequest\(\)/);
});
for (const result of results) console.log(JSON.stringify(result));
if (results.some(result => result.status === 'FAIL')) process.exitCode = 1;
else console.log('PH80/81 full scrollable history, zero text measurement and one-shot native focus lifecycle PASS; keyboard pixels remain a platform gate.');
