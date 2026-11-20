// Actual history failure -> ReaderPageState action slot SDK lowering.
// The class-only button port records construction and the original retry callback;
// native layout, pointer handling and device crash evidence are outside this probe.
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
const selected = selectContractCases({ 'failure-action-slot': {
  description: 'Search history load/clear failure slots construct the retry component; old inline class calls throw', resources: [],
} });
for (const id of selected) {
  const { default: assert } = await import('node:assert/strict');
  const { readFileSync } = await import('node:fs');
  const { createEtsBuilderProbe, builderComponentMembers } = await import('./lib/ets-builder-probe.mjs');
  const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
  const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
  const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
  const { selectedProductionClasses, selectedProductionValues } = await import('./lib/selected-production-methods.mjs');
  const { readerSearchHistoryControlHeight }=await import('../entry/src/main/ets/features/common/ReaderSearchControlGeometry.ts');
  const { readerAppColor } = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
  const { ts, options }=installedEtsCompiler();
  const fonts = await import('../entry/src/main/ets/features/common/ReaderFontFamilies.ts');
  const read = name => readFileSync(new URL(`../entry/src/main/ets/${name}`, import.meta.url), 'utf8');
  const history = read('features/search/ReaderSearchHistoryPanel.ets');
  const {SearchHistoryGeometry,projectSearchHistoryRows}=pureModuleProbe(read('features/search/SearchHistoryGeometry.ts'),'SearchHistoryGeometry.ts',{readerSearchHistoryControlHeight},['SearchHistoryGeometry','projectSearchHistoryRows']);
  const state = read('features/common/ReaderPageState.ets');
  const typography = new URL('../entry/src/main/ets/features/common/ReaderTypography.ets', import.meta.url);
  const { ReaderTextStyle } = selectedProductionClasses(typography, ['ReaderTextStyle']);
  const headingStyle = selectedProductionValues(typography, ['TYPE_SEARCH_HISTORY_HEADING'], { ...fonts, ReaderTextStyle });
  const messageStyles = pureModuleProbe(read('features/common/ReaderMessageStyle.ets'), 'ReaderMessageStyle.ets',
    { ...fonts, ReaderTextStyle }, ['MESSAGE_TITLE', 'MESSAGE_BODY', 'MESSAGE_LIST_TITLE', 'MESSAGE_LIST_BODY']);
  class ButtonPort {
    constructor(owner, params, _storage, elementId) {
      Object.assign(this, { owner, params, id: elementId });
    }
  }
  function fixture(source, status) {
    const properties = createArkUIPropertyRuntimeProbe();
    const childSources = { ReaderPageState: state, ReaderButton: read('features/common/ReaderButton.ets'),
      ReaderRecoveryAction: read('features/common/ReaderRecoveryAction.ets') };
    const hooks = { ...properties.hooks, childSources, mountChildren: true, lifecycleChildren: true };
    const deps = { ...properties.sdk, ...messageStyles, ...headingStyle, readerAppColor,
      ReaderButton: ButtonPort, ReaderRecoveryAction: ButtonPort, projectSearchHistoryRows };
    const State = createEtsBuilderProbe(state, builderComponentMembers(state), deps, hooks).Component;
    // This probe selects the actual Builders. Imported status-alias property
    // typing belongs to full ArkTS compilation, not this focused SDK transform.
    const probe = createEtsBuilderProbe(source, ['build', 'retryHistoryAction', 'projectedRows', 'feedbackMeasurement'],
      { ...deps, ReaderPageState: State }, hooks);
    Object.assign(probe.owner, { status, history: [], appThemeScheme: 'day',geometry:new SearchHistoryGeometry(366,300,1,false,status),
      measuredControlWidth:()=>assert.fail('empty failure fixture must not request a native label measure'),onFeedbackHeight:()=>{} });
    let retries = 0;
    probe.owner.onRetry = () => { retries++; };
    return { ...probe, retries: () => retries };
  }
  const walk = owner => [owner, ...[...(owner.children?.values() ?? [])].flatMap(walk)];
  // Place the historical inline class invocation in the current real slot.
  // Locate its public BuilderParam via the SDK AST, independently of private
  // retry helper naming or whitespace.
  const tree=ts.createSourceFile('ReaderSearchHistoryPanel.ets',history,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
  assert.deepEqual(tree.parseDiagnostics,[]);const slots=[];
  const visit=node=>{if(ts.isPropertyAssignment(node)&&node.name.getText(tree)==='actionContent')slots.push(node.initializer);ts.forEachChild(node,visit);};visit(tree);assert.equal(slots.length,1);
  const slot=slots[0],old=history.slice(0,slot.getStart(tree))+`(): void => { ReaderButton({scheme:this.appThemeScheme,specId:'search-secondary',label:this.status === 'clearFailed' ? '重试清空':'重试读取',onAction:():void=>this.onRetry()}); }`+history.slice(slot.end);
  assert.notEqual(old, history);

  for (const [status, label] of [['loadFailed', '重试读取'], ['clearFailed', '重试清空']]) {
    const current = fixture(history, status);
    assert.doesNotThrow(() => current.owner.initialRender(), 'actual failed-state action slot mounts');
    const buttons = walk(current.owner).filter(child => child instanceof ButtonPort);
    assert.equal(buttons.length, 1, 'the failure owns exactly one retry action');
    assert.equal(buttons[0].params.label, label);
    buttons[0].params.onAction();
    assert.equal(current.retries(), 1, 'the original retry callback reaches the history owner');
    const crash = fixture(old, status);
    assert.throws(() => crash.owner.initialRender(),
      error => error instanceof TypeError && /class constructor.*without 'new'/i.test(error.message),
      'old inline retry component call throws when the failed-state slot mounts');
  }
  recordContractCasePass(id);
}
