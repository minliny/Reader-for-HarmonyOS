import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={"top-scroll": {"description": "实际history初始TopStart Scroll与当前非负gap", "resources": []}, "all-history": {"description": "35条首屏前全部可见且零文本测量，无展开隐藏", "resources": []}, "late-history": {"description": "异步历史/窄宽tablet保留全部记录与Scroll", "resources": []}, "status-actions": {"description": "无源/加载失败保留本地历史点击与恢复动作", "resources": []}, "focus-state": {"description": "实际SearchViewState焦点只消费一次与reset退休", "resources": []}, "history-feedback": {"description": "三入口各自loading/read-failed/clear-failed反馈及retry", "resources": []}, "native-focus": {"description": "实际ReaderSearchField布局后焦点、卸载/回程不抢焦点", "resources": []}};
for(const id of selectContractCases(definitions)){await runSelectedCase(id);recordContractCasePass(id);}
async function runSelectedCase(selectedCase){
const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
const {default: assert} = await import('node:assert/strict');
const { foundationControls } = await import('./lib/reader-foundation-control-probe.mjs');
const { readFileSync } = await import('node:fs');
const { createRequire } = await import('node:module');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { SearchViewState } = await import('../entry/src/main/ets/features/search/SearchViewState.ts');
const {selectedProductionMethods} = await import('./lib/selected-production-methods.mjs');
const { readerFloatingBarBottomInset } = await import('./lib/reader-floating-bar-metrics-probe.mjs');


const source=readFileSync(new URL('../entry/src/main/ets/features/search/SearchPage.ets',import.meta.url),'utf8');
// StateContent branches reference the page's other real Builders; register
// their production names with the same SDK registry without executing them.
const require = createRequire(import.meta.url);
const sdkRoot = resolveEtsLoaderRoot();
const { CUSTOM_BUILDER_METHOD } = require(`${sdkRoot}/lib/component_map.js`);
for (const match of source.matchAll(/@Builder\s+(?:private\s+)?(\w+)\s*\(/g)) CUSTOM_BUILDER_METHOD.add(match[1]);
const enumValues = name => new Proxy({}, { get: (_, key) => `${name}.${String(key)}` });
const caseNames={'top-scroll': 'initial history Scroll uses the top of the content viewport', 'all-history': 'all history appears before layout without per-item measurement or expansion', 'late-history': 'async history and narrow/tablet widths preserve every entry and existing scroll', 'status-actions': 'no-source and load-error entries retain history chips and their actions', 'focus-state': 'fresh-entry focus is consumed once and reset/return cannot recreate it', 'history-feedback': 'history loading, failure and retry render independently on every entry surface', 'native-focus': 'native focus waits for layout and a removed or returning page never steals it'};
function check(name, fn) {
  if(name!==caseNames[selectedCase])return;fn();
}
function fixture(history, { width = 0, tablet = false, kind = 'initial', historyStatus,
  measureVp = text => text.length * 13 } = {}) {
  let owner;
  const controls=foundationControls();
  const measurements = [];
  const actions = [];
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
    ['stateContent', 'searchHeaderHeight', 'searchBottomInset', 'sourceRequiredReason', 'initialContent', 'sourceRequiredContent', 'sourceLoadErrorContent',
      'operation', 'retryOperation', 'primaryPill', 'secondaryPill', 'refreshVisibleResults', 'publishVisibleGroups'],
    { ...controls.dependencies, Flex, FlexWrap: enumValues('FlexWrap'), FlexDirection: enumValues('FlexDirection'), readerFloatingBarBottomInset,
      ReaderWindowCoordinator: { metrics: () => ({ systemInsets: {}, cutoutInsets: {}, gestureInsets: {}, navigationInsets: {} }) },
      FlexAlign: enumValues('FlexAlign'), TOK_BORDER_W: 1, TOK_SPACE_XS: 8,
      TOK_SPACE_CARD_PADDING: 12, TOK_SPACE_ROW_BLOCK: 4 },controls.hooks));
  Object.assign(owner, {
    presentation: kind === 'sourceRequired' ? { kind, reason: 'noSources', history, historyStatus } : { kind, history, historyStatus },
    isTablet: tablet,
    historyWidth: width,
    viewState: new SearchViewState(),
    viewStateRevision: -1, appThemeScheme: 'day', keyword: '',
    onManageSources: () => actions.push('manage'),
    onRetry: () => actions.push('retry'),
    onBack: () => actions.push('back'),
    submitSearch: () => actions.push(`search:${owner.keyword}`),
    onClearHistory: () => actions.push('clear'),
    onRetryHistory: () => actions.push('retry-history'),
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
  return { owner, measurements, actions, nodes: () => controls.nodes(owner),
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
  assert.ok(Number.isFinite(f.areas()[0].padding.top)&&f.areas()[0].padding.top>=0,'current gap is a bounded production output');
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
    assert.ok(f.owner.historyWidth>0&&f.owner.historyWidth<=260,'measured history fits host');assert.equal(f.measurements.length,0);
    assert.ok(f.nodes().some(n=>n.type==='Text'&&n.create==='加载后历史'));
    assert.equal(f.nodes().find(n=>n.type==='Scroll').align,'Alignment.TopStart');
  }
});
check('no-source and load-error entries retain history chips and their actions', () => {
  for (const [kind, actionLabel, expectedAction] of [
    ['sourceRequired', '添加书源', 'manage'],
    ['sourceLoadError', '重试加载', 'retry'],
  ]) {
    const f = fixture(['本地书'], { kind });
    assert.equal(f.nodes().filter(node => node.type === 'Scroll').length, 1,
      'status and history share one scroll viewport');
    const action = f.nodes().find(node => node.type === 'Text' && node.create === actionLabel);
    const chip = f.nodes().find(node => node.type === 'Text' && node.create === '本地书');
    assert.ok(action, `${kind} exposes its online-source recovery action`);
    assert.ok(chip, `${kind} keeps the local search shortcut`);
    action.onClick();
    chip.onClick();
    assert.deepEqual(f.actions, [expectedAction, 'search:本地书']);
    dispatchArea(f, 260);
  }
});
check('fresh-entry focus is consumed once and reset/return cannot recreate it',()=>{
  const state=new SearchViewState();assert.equal(state.consumeInputFocusRequest(),false);
  state.requestInputFocus();assert.equal(state.consumeInputFocusRequest(),true);assert.equal(state.consumeInputFocusRequest(),false);
  state.reset('新查询');assert.equal(state.consumeInputFocusRequest(),false);
  state.requestInputFocus();state.reset();assert.equal(state.consumeInputFocusRequest(),false);
});
check('history loading, failure and retry render independently on every entry surface', () => {
  for (const kind of ['initial', 'sourceRequired', 'sourceLoadError']) {
    for (const [historyStatus, label, retry] of [
      ['loading', '正在读取搜索历史', undefined],
      ['loadFailed', '搜索历史读取失败', '重试读取'],
      ['clearFailed', '搜索历史清空失败', '重试清空'],
    ]) {
      const f = fixture(['保留记录'], { kind, historyStatus });
      assert.ok(f.nodes().some(node => node.type === 'Text' && node.create === label));
      assert.ok(f.nodes().some(node => node.type === 'Text' && node.create === '保留记录'));
      const clear = f.nodes().find(node => node.type === 'Text' && node.create === '清空记录');
      assert.equal(clear.enabled, historyStatus !== 'loading');
      if (retry) {
        f.nodes().find(node => node.type === 'Text' && node.create === retry).onClick();
        assert.deepEqual(f.actions, ['retry-history']);
      }
    }
    const empty = fixture([], { kind, historyStatus: 'ready' });
    assert.ok(!empty.nodes().some(node => /搜索历史.*失败|正在读取搜索历史/.test(String(node.create ?? ''))));
  }

});
check('native focus waits for layout and a removed or returning page never steals it',()=>{
  const path=new URL('../entry/src/main/ets/features/common/ReaderSearchField.ets',import.meta.url);
  const frames=[],focus=[];
  const Field=selectedProductionMethods(path,'ReaderSearchField',['aboutToAppear','aboutToDisappear'],{
    ReaderSearchFocusFrame:class{constructor(action){this.action=action;}onIdle(){this.action();}}});
  const owner=Object.assign(new Field(),{mounted:false,focusGeneration:0,variant:'bookPage',mode:'submit',focusOnAppear:true,
    getUIContext:()=>({postFrameCallback:frame=>frames.push(frame),getFocusController:()=>({requestFocus:id=>focus.push(id)})})});
  owner.aboutToAppear();assert.equal(focus.length,0);frames.shift().onIdle();assert.deepEqual(focus,['reader-book-search-input']);
  owner.aboutToAppear();owner.aboutToDisappear();frames.shift().onIdle();assert.equal(focus.length,1);
  owner.focusOnAppear=false;owner.aboutToAppear();assert.equal(frames.length,0);

});

}
