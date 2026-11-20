import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const root = new URL('../', import.meta.url);
const pagePath = 'entry/src/main/ets/features/source/SourceManagementPage.ets';
const read = path => readFileSync(new URL(path, root), 'utf8');
const outputArgs = process.argv.slice(2).filter(arg => arg.startsWith('--evidence-path='));
assert.ok(outputArgs.length <= 1);
const evidencePath = outputArgs[0]?.slice('--evidence-path='.length);
if (evidencePath) assert.ok(evidencePath.startsWith('.reader-artifacts/') && !evidencePath.includes('..'));
const selected = selectContractCases({ 'sdk-selection': 'Retained actual SDK Source status/category child updaters and actual ReaderButton props/native selected/surface; old primitive snapshot negative, no Builder replay/remount or native device claim.' },
  { argv: process.argv.slice(2).filter(arg => !arg.startsWith('--evidence-path=')) });
if (selected.length === 0) process.exit(0);
const {foundationControls,foundationSpecs}=await import('./lib/reader-foundation-control-probe.mjs');
const {createReaderComponentProbe:createReaderBuilderProbe}=await import('./lib/reader-component-probe.mjs');
const {installedEtsCompiler}=await import('./lib/ets-compiler-runtime.mjs');
const {sourceFilterBuilderMembers:filterMembers}=await import('./lib/source-filter-sdk-selection.mjs');
const {readerAppColor}=await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
const {readerSourceCategoryLabel}=await import('../entry/src/main/ets/features/source/ReaderSourceCategory.ts');

function sourceTree(source) {
  const {ts,options}=installedEtsCompiler();
  const tree=ts.createSourceFile('SourceManagementPage.ets',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
  assert.deepEqual(tree.parseDiagnostics,[],'actual whole Source page parses');
  const owner=tree.statements.find(node=>node.name?.text==='SourceManagementPage'&&node.members);
  assert.ok(owner,'actual Source owner');
  return {ts,tree,owner};
}
function walk(ts,node,visit) { visit(node);ts.forEachChild(node,child=>walk(ts,child,visit)); }
function statusBinding(source) {
  const parsed=sourceTree(source),{ts,tree,owner}=parsed,matches=[];
  for(const member of owner.members)walk(ts,member,node=>{
    if(!(ts.isCallExpression(node)||ts.isEtsComponentExpression(node))||node.expression.getText(tree)!=='ReaderButton')return;
    const values=node.arguments?.[0];if(!values||!ts.isObjectLiteralExpression(values))return;
    const spec=values.properties.find(p=>p.name?.getText(tree)==='specId');let statusSpec=false;
    if(spec)walk(ts,spec,node=>{if(ts.isStringLiteral(node)&&node.text.startsWith('source-management-status-'))statusSpec=true;});
    if(statusSpec)matches.push({member,primary:values.properties.find(p=>p.name?.getText(tree)==='primary')});
  });
  assert.equal(matches.length,1,'one actual finite status button producer');
  assert.ok(matches[0].primary?.initializer,'actual selected value expression');
  return {...parsed,...matches[0]};
}
function edit(source,edits) {
  let boundary=source.length;
  for(const e of edits.sort((a,b)=>b.start-a.start)){assert.ok(e.end<=boundary,'independent AST edits');source=source.slice(0,e.start)+e.text+source.slice(e.end);boundary=e.start;}
  return source;
}
function primitiveSnapshot(source) {
  const {ts,tree,owner,member,primary}=statusBinding(source),name=member.name.getText(tree),edits=[
    {start:primary.initializer.getStart(tree),end:primary.initializer.end,text:'capturedSelection'},
    {start:member.parameters.end,end:member.parameters.end,text:', capturedSelection: boolean'},
  ];
  const parameters=member.parameters.map(p=>p.name.getText(tree));let calls=0;
  walk(ts,owner,node=>{
    if(!ts.isCallExpression(node)||!ts.isPropertyAccessExpression(node.expression)||node.expression.expression.kind!==ts.SyntaxKind.ThisKeyword||node.expression.name.text!==name)return;
    assert.equal(node.arguments.length,parameters.length,'actual filter call arguments');
    const expression=primary.initializer.getText(tree),substitutions=[];
    walk(ts,primary.initializer,part=>{
      if(!ts.isIdentifier(part)||!parameters.includes(part.text))return;
      const position=parameters.indexOf(part.text);
      substitutions.push({start:part.getStart(tree)-primary.initializer.getStart(tree),end:part.end-primary.initializer.getStart(tree),text:'('+node.arguments[position].getText(tree)+')'});
    });
    edits.push({start:node.arguments.end,end:node.arguments.end,text:', '+edit(expression,substitutions)});calls++;
  });
  assert.ok(calls>0,'actual status helper callers');
  return edit(source,edits);
}
function equivalentStatusHelper(source) {
  const {ts,tree,owner,member,primary}=statusBinding(source),name=member.name.getText(tree),edits=[
    {start:member.name.getStart(tree),end:member.name.end,text:'statusChoiceForProbe'},
    {start:primary.initializer.getStart(tree),end:primary.initializer.end,text:'('+primary.initializer.getText(tree)+')'},
  ];
  walk(ts,owner,node=>{if(ts.isPropertyAccessExpression(node)&&node.expression.kind===ts.SyntaxKind.ThisKeyword&&node.name.text===name)edits.push({start:node.name.getStart(tree),end:node.name.end,text:'statusChoiceForProbe'});});
  return edit(source,edits);
}

function scenario(source) {
  const controls = foundationControls({ windowMetrics: () => ({ systemFontScale: 1.45 }) });
  const probe = createReaderBuilderProbe(source, filterMembers(source), {
    ...controls.dependencies, readerSourceCategoryLabel, ScrollDirection: { Horizontal: 'horizontal' },
  }, controls.hooks);
  const parent = probe.owner;
  let rebuilds = 0;
  Object.assign(parent, { appThemeScheme: 'day', contentFrame: () => ({ width: 328 }),
    filterControlWidth: () => 328, layoutBudget: () => ({ statusContentWidth: 494, filterHeight: 52 }),
    rebuildSourceProjection() { rebuilds++; } });
  parent.statusFilter();
  const statusChildren = [...parent.children.values()];
  parent.categoryFilter();
  const categoryChildren = [...parent.children.values()].filter(child => !statusChildren.includes(child));
  assert.deepEqual(statusChildren.map(child => child.label), ['全部', '启用', '异常', '未检测', '自定义']);
  assert.equal(categoryChildren.length, 7);
  const statusIds = statusChildren.map(child => child.id), categoryIds = categoryChildren.map(child => child.id);
  const initialChildren = [...parent.children.values()], initialObservers = parent.observers.length;
  const observerIdentities = initialChildren.map(child => parent.observers[child.id]);
  function rendered(child) {
    const text = [...child.nodes.values()].find(node => node.type === 'Text' && node.create === child.label);
    assert.ok(text, child.label);
    return { label: child.label, specId: child.specId, primary: child.primary, selected: text.accessibilitySelected,
      backgroundColor: text.backgroundColor, color: text.fontColor, enabled: text.enabled };
  }
  function retainedReplay(ids) {
    parent.replayOnly(ids);
    // Deliver only the real ReaderButton @Prop dependencies. The Source
    // Builder/Row/ForEach observers are deliberately never replayed here.
    controls.properties.flush(owner => owner !== parent);
    assert.equal(parent.observers.length, initialObservers, 'no Builder re-entry or new native observer');
    assert.deepEqual([...parent.children.values()], initialChildren, 'all actual child instances are retained');
    assert.deepEqual(initialChildren.map(child => parent.observers[child.id]), observerIdentities, 'the same compiled child updater closures are retained');
  }
  const status = [{ ownerValue: parent.statusValue, rendered: statusChildren.map(rendered) }];
  const callback = statusChildren[1].onAction;
  callback();
  assert.equal(parent.statusValue, '启用');
  assert.equal(rebuilds, 1);
  retainedReplay(statusIds);
  status.push({ ownerValue: parent.statusValue, rendered: statusChildren.map(rendered) });
  statusChildren[2].onAction();
  assert.equal(parent.statusValue, '异常');
  retainedReplay(statusIds);
  status.push({ ownerValue: parent.statusValue, rendered: statusChildren.map(rendered) });
  statusChildren[3].onAction();
  retainedReplay(statusIds);
  status.push({ ownerValue: parent.statusValue, rendered: statusChildren.map(rendered) });
  statusChildren[0].onAction();
  retainedReplay(statusIds);
  status.push({ ownerValue: parent.statusValue, rendered: statusChildren.map(rendered) });
  const beforeDisabled = parent.statusValue;
  statusChildren[4].onAction();
  retainedReplay(statusIds);
  assert.equal(parent.statusValue, beforeDisabled, 'disabled custom cannot change owner state');
  assert.equal(statusChildren[4].primary, false, 'disabled custom never becomes selected');
  assert.equal(statusChildren[4].onAction, initialChildren[4].onAction, 'callback identity retained');
  assert.equal(statusChildren[1].onAction, callback, 'captured action identity retained');
  const category = [{ ownerValue: parent.categoryValue, rendered: categoryChildren.map(rendered) }];
  for (const index of [1, 2, 0]) {
    categoryChildren[index].onAction();
    retainedReplay(categoryIds);
    category.push({ ownerValue: parent.categoryValue, rendered: categoryChildren.map(rendered) });
  }
  return { output: probe.output, status, category, children: initialChildren.length,
    observers: initialObservers, sameChildUpdaterOnly: true, sharedPropertyRuntime: controls.properties.source };
}

function assertSelection(samples, labelOfValue = value => value) {
  for (const sample of samples) {
    const expected = labelOfValue(sample.ownerValue);
    const selected = sample.rendered.filter(child => child.primary || child.selected);
    assert.deepEqual(selected.map(child => child.label), [expected], `current owner ${sample.ownerValue} controls retained child props and native selected`);
    for (const child of sample.rendered) {
      const active = child.label === expected;
      assert.equal(child.primary, active);
      assert.equal(child.selected, active);
      const spec = foundationSpecs().resolveReaderButtonSpec(child.specId);
      assert.equal(child.backgroundColor, readerAppColor(active ? spec.primarySurface : spec.secondarySurface, 'day'), `actual ${child.label} modifier surface follows owner`);
    }
  }
}

if (selected.includes('sdk-selection')) {
  const source = read(pagePath), live = scenario(source);
  if (evidencePath) {
    writeFileSync(new URL(evidencePath.replace(/\.json$/, '-actual-sdk.js'), root), live.output);
    writeFileSync(new URL(evidencePath.replace(/\.json$/, '-observed.json'), root), JSON.stringify(live, null, 2) + '\n');
  }
  assertSelection(live.status);
  assertSelection(live.category, value => value === 'all' ? '全部类型' : readerSourceCategoryLabel(value));
  const equivalent=scenario(equivalentStatusHelper(source));
  assertSelection(equivalent.status);assertSelection(equivalent.category,value=>value==='all'?'全部类型':readerSourceCategoryLabel(value));
  // Move the actual current selection expression to each real call site and
  // capture its primitive parameter in the retained child updater. No private
  // helper name, parameter spelling, literal width or expression text is fixed.
  const old=primitiveSnapshot(source);
  assert.notEqual(old, source);
  const stale = scenario(old);
  assert.throws(() => assertSelection(stale.status), assert.AssertionError,
    'same retained child updater rejects the previous primitive snapshot implementation');
  assertSelection(stale.category, value => value === 'all' ? '全部类型' : readerSourceCategoryLabel(value));
  const dependencies = [pagePath, 'entry/src/main/ets/features/common/ReaderButton.ets',
    'entry/src/main/ets/features/common/ReaderControlSpecs.ets', 'tools/test-source-filter-live-selection.mjs',
    'tools/lib/reader-component-probe.mjs', 'tools/lib/ets-compiler-runtime.mjs', 'tools/lib/reader-foundation-control-probe.mjs',
    'tools/lib/arkui-property-runtime-probe.mjs'];
  const result = { status: 'PASS', live, negative: { implementation: 'previous primitive active parameter',
    rejected: true, status: stale.status, categoryUnchangedAndLive: true },
    inputs: dependencies.map(path => ({ path, sha256: createHash('sha256').update(read(path)).digest('hex') })),
    boundary: 'actual installed SDK lowering/property/update/modifier recording; no real renderer/hit/focus/native acceptance' };
  if (evidencePath) {
    writeFileSync(new URL(evidencePath, root), JSON.stringify(result, null, 2) + '\n');
    writeFileSync(new URL(evidencePath.replace(/\.json$/, '-old-sdk.js'), root), stale.output);
  }
  console.log(JSON.stringify({ statusSamples: live.status.length, categorySamples: live.category.length,
    retainedChildren: live.children, sameChildUpdaterOnly: true, negativeRejected: true }));
  recordContractCasePass('sdk-selection');
}
