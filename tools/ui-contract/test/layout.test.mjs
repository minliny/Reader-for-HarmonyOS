import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateLayout, layoutTapPoint, normalizeHarmonyLayout, selectLayoutNode } from '../lib/layout.mjs';
import { evaluateStructure } from '../lib/structure.mjs';
import { loadStructureDefinition } from '../lib/structure-contract.mjs';
import { readyForStep, requestedOperation } from '../collectors/harmonyos/records.mjs';

const density = 3.5;
const windowId = '42';
const field = 'reader-bookshelf-search-field';
const submit = 'reader-bookshelf-search-submit';
const bar = 'reader-bookshelf-search-bar';
const back = 'reader-library-search-back';
const clip = 'reader-control-motion-content-clip';
const content = 'reader-control-content-host';
const title = 'Reader Phase 0 Public Fixture';
const bounds = (left, top, right, bottom) =>
  `[${Math.round((left + 10) * density)},${Math.round((top + 20) * density)}]` +
  `[${Math.round((right + 10) * density)},${Math.round((bottom + 20) * density)}]`;

function node(id, box, { children = [], ...attributes } = {}) {
  return {
    attributes: {
      id, origBounds: bounds(...box), bounds: bounds(...box), hostWindowId: windowId,
      visible: 'true', focused: 'false', enabled: 'true', opacity: '1.000000', clip: 'false',
      ...attributes,
    },
    children,
  };
}

function dump(nodes, other = []) {
  return {
    attributes: { bounds: '[0,0][600,900]' },
    children: [
      node('', [0, 0, 100, 200], {
        bundleName: 'io.reader.minliny', type: 'root', abilityName: 'EntryAbility', pagePath: 'pages/Index',
        children: nodes,
      }),
      ...other,
    ],
  };
}

function report({ rects = [], keyboardRevision = 8 } = {}) {
  return {
    windowId, vpPixels: density,
    metrics: {
      ready: true, revision: 8, densityPixels: density,
      windowRect: { left: 0, top: 0, width: 100, height: 200 },
      globalRect: { left: 10, top: 20, width: 100, height: 200 },
      keyboardArea: { available: true, visible: rects.length > 0, rects, revision: keyboardRevision },
      keyboardInsets: { left: 0, top: 0, right: 0, bottom: 0 },
    },
  };
}

function sample(tree, extras = {}) {
  return normalizeHarmonyLayout({
    tree, report: report(), sampleId: 'stable', instanceId: 'instance-2',
    evidenceRefs: ['tree', 'window'], ...extras,
  });
}

function search(headerTop = 20, fieldOffset = 0) {
  return node(bar, [0, headerTop, 100, headerTop + 20], {
    accessibilityId: '1',
    children: [
      node(back, [0, headerTop, 10, headerTop + 20]),
      node('reader-bookshelf-search-lane-row', [10, headerTop, 90, headerTop + 20], {
        children: [
          node(field, [10 + fieldOffset, headerTop, 50 + fieldOffset, headerTop + 20], {
            accessibilityId: '2',
          }),
          node(submit, [55, headerTop, 90, headerTop + 20], { clickable: 'true', accessibilityId: '3' }),
        ],
      }),
    ],
  });
}

function reading({ clipEnabled = true, overrun = false, hideOverrun = true } = {}) {
  const childRight = overrun ? 70 : 60;
  const childVisibleRight = hideOverrun ? 60 : childRight;
  return node(clip, [20, 100, 60, 150], {
    clip: String(clipEnabled),
    children: [node(content, [30, 110, childRight, 140], { bounds: bounds(30, 110, childVisibleRight, 140) })],
  });
}

function check(assertion, current, baseline) {
  return evaluateLayout({ sample: 'current', ...assertion }, new Map([['current', current], ['baseline', baseline]]));
}

test('AutoPage Quick interval dispatch requires the current native label and the contained plus button', () => {
  const currentAlias = seconds => 'reader-auto-speed-current-' + seconds;
  const plusAlias = seconds => 'reader-auto-speed-increase-from-' + seconds;
  const state = seconds => ({ anchors:[currentAlias(seconds)], keyboard:false });
  const action = seconds => ({ id:'increase-autoPage-interval-'+ (seconds+1),kind:'action',op:'click',
    from:'speed',target:plusAlias(seconds) });
  const exposedAction = seconds => ({...action(seconds),
    from:seconds === 8 ? 'enter-autoPage-state' : 'autopage-interval-' + seconds,
    target:'reader-auto-speed-increase-exposed-from-' + seconds});
  const exposedOperation = (seconds, layout, overrides, currentFixture = fixture) => {
    const step = {...exposedAction(seconds),...overrides};
    return requestedOperation(step,{[step.from]:layout},currentFixture);
  };
  const fixture = {id:'public-local-reading-v1'};
  function quick({seconds = 8, clipPlus = false, hidePlus = false, duplicate = false,
    collapseEnabled = false, full = false, wrongValue = false, optIn = true,
    glyphBox = [66,135,80,156], siblingBox = [70,134,80,155], siblingAttributes = {}} = {}) {
    const text = (value, box) => node('',box,{type:'Text',text:'',originalText:value});
    const plus = node('',[64,132,82,158],{
      type:'Button', accessibilityId:'2', clickable:'true',
      hitTestBehavior:hidePlus ? 'HitTestMode.None' : 'HitTestMode.Default',
      ...(clipPlus ? {bounds:bounds(64,132,72,158)} : {}),
      children:[text('+',glyphBox)],
    });
    const minus = node('',[22,132,40,158],{type:'Button',accessibilityId:'1',clickable:'true',
      hitTestBehavior:'HitTestMode.Default',children:[text('−',[24,134,38,156])]});
    const current = node('reader-auto-speed-current',[45,139,59,151],{
      type:'Text',text:`${seconds} 秒`,originalText:`${wrongValue ? seconds+1 : seconds} 秒`,
    });
    const retainedMaximum = node('reader-auto-speed-maximum',siblingBox,{
      type:'Text',originalText:'20 秒',opacity:'0.000000',hitTestBehavior:'HitTestMode.Default',...siblingAttributes,
    });
    const row = node('',[17,128,88,164],{
      type:'Stack',children:[minus,current,plus,retainedMaximum,...duplicate?[plus]:[]],
    });
    const viewport = node('reader-control-module-autoPage',[5,35,95,185],{type:'Scroll',clip:'true',children:[row]});
    const panel = node(full ? 'reader-session-morph-fullAutoPagePlayback' : 'reader-session-morph-quickAutoPage',
      [5,35,95,185],{type:'Stack',children:[viewport]});
    const collapse = node('reader-control-collapse',[80,15,96,32],{type:'Button',enabled:String(collapseEnabled)});
    return sample(dump([panel,collapse]),{observeQuickAutoPageSpeed:optIn});
  }
  for (let seconds = 8; seconds <= 12; seconds += 1) {
    const layout = quick({seconds});
    assert.equal(readyForStep(state(seconds),layout),true);
    assert.equal(readyForStep(state(seconds-1),layout),false);
    const point = requestedOperation(action(seconds),{speed:layout},fixture);
    assert.deepEqual(point,{op:'click',x:290,y:577});
    assert.throws(() => requestedOperation(action(seconds-1),{speed:layout},fixture),/missing/);
    if (seconds < 12) {
      assert.deepEqual(exposedOperation(seconds,layout),{op:'click',x:290,y:535});
      const button = selectLayoutNode(layout,plusAlias(seconds));
      const fullButton = {left:259,top:532,width:63,height:91};
      assert.deepEqual(button.rectPx,fullButton);
      assert.deepEqual(button.visibleRectPx,fullButton);
    }
  }
  assert.throws(() => exposedOperation(9,quick()),/missing/);
  assert.throws(() => exposedOperation(8,quick(),{from:'stale'}),/exact public Quick action/);
  assert.throws(() => exposedOperation(8,quick(),undefined,{id:'other'}),/exact public Quick action/);
  for (const unproven of [
    {siblingBox:[70,132,80,155]}, {siblingAttributes:{origBounds:undefined}},
    {siblingAttributes:{hostWindowId:'9'}}, {siblingAttributes:{bounds:bounds(72,134,80,155)}},
    {glyphBox:[66,132,80,156]}, {glyphBox:[66,130,80,156]}, {glyphBox:[66,135,72,156]},
  ]) {
    const layout = quick(unproven);
    assert.deepEqual(requestedOperation(action(8),{speed:layout},fixture),{op:'click',x:290,y:577});
    assert.throws(() => exposedOperation(8,layout),/no verified exposed native top interval/);
  }
  for (const incompatible of [
    {clipPlus:true},{hidePlus:true},{duplicate:true},{collapseEnabled:true},{full:true},{wrongValue:true},{optIn:false},
  ]) {
    const layout = quick(incompatible);
    assert.equal(readyForStep(state(8),layout),false);
    assert.throws(() => requestedOperation(action(8),{speed:layout},fixture),/missing/);
    assert.throws(() => exposedOperation(8,layout),/missing/);
  }
});

test('Phase 1 search append maps only the two public titles on true online rows of their native list', () => {
  const fixture = {cedar:'Reader Phase 1 Online Cedar',maple:'Reader Phase 1 Online Maple'};
  const name = role => `reader-search-public-online-result-${role}`;
  const viewport = 'reader-search-result-list:2:8';
  const onlineIdentity = 'online:opaque-source-and-book-key';
  function row(title, key = onlineIdentity, page = 2, query = 8, type = 'Button', author = '') {
    return node(`reader-search-result:${JSON.stringify([page,query,key])}`,[2,40,98,70],{type,children:[
      node('',[2,40,98,70],{type:'Row',children:[
        node('',[25,40,98,70],{type:'Column',children:[
          node('',[25,40,98,70],{type:'Column',children:[
            node('',[27,43,94,51],{type:'Text',originalText:title}),
            node('',[27,53,94,60],{type:'Text',originalText:author}),
          ]}),
        ]}),
      ]}),
    ]});
  }
  const list = children => node(viewport,[0,26,100,190],{type:'List',children});
  const valid = sample(dump([list([row(fixture.cedar),row(fixture.maple,'online:second-private-key')])]),
    {publicOnlineResultTitles:fixture});
  for (const role of ['cedar','maple']) {
    const result = selectLayoutNode(valid,{id:name(role),ancestors:[viewport]});
    assert.deepEqual(result.publicOnlineRoles,[role]);
    assert.deepEqual(result.searchResultMount,{page:2,queryRevision:8,kind:'online'});
    assert.equal(result.id,null);
    assert.equal(result.searchTitleObserved,true);
  }
  assert.ok(!JSON.stringify(valid).includes(onlineIdentity));
  assert.ok(!JSON.stringify(valid).includes(fixture.cedar));
  for (const nodes of [
    [list([row(fixture.cedar,'local:public-or-private-opaque-key')])],
    [list([row(fixture.cedar,onlineIdentity,2,7)])],
    [list([]),row(fixture.cedar)],
    [list([row(fixture.cedar,onlineIdentity,2,8,'Column')])],
    [list([row('Another actual title',onlineIdentity,2,8,'Button',fixture.cedar)])],
  ]) {
    const wrong = sample(dump(nodes),{publicOnlineResultTitles:fixture});
    assert.throws(() => selectLayoutNode(wrong,name('cedar')),/missing/);
  }
  const duplicate = sample(dump([list([row(fixture.cedar),row(fixture.cedar,'online:second-private-key')])]),
    {publicOnlineResultTitles:fixture});
  assert.throws(() => selectLayoutNode(duplicate,name('cedar')),/ambiguous/);
  const unrelated = sample(dump([list([row(fixture.cedar)])]),{publicBookTitle:title});
  assert.ok(unrelated.nodes.every(node => !node.searchResultMount && !node.publicOnlineRoles));
  assert.throws(() => selectLayoutNode(unrelated,name('cedar')),/missing/);
  const unseen = sample(dump([list([row(undefined,onlineIdentity,2,8,'Button',fixture.cedar)])]),
    {publicOnlineResultTitles:fixture});
  assert.throws(() => selectLayoutNode(unseen,name('cedar')),/missing/);
  assert.equal(unseen.nodes.find(item => item.searchResultMount).searchTitleObserved,undefined);
});

test('scopes a Reader node to the normal window and rejects within-window ambiguity', () => {
  const external = node(field, [0, 0, 10, 10], { hostWindowId: '9', bundleName: 'com.ohos.sceneboard' });
  const searchTree = sample(dump([search()], [external, external]));
  const selected = selectLayoutNode(searchTree, { id: field, ancestors: [bar] });
  assert.equal(selected.key, '2');
  assert.deepEqual(layoutTapPoint(selectLayoutNode(searchTree, submit)), { x: 289, y: 175 });
  assert.equal(searchTree.branch, 'row');
  assert.throws(() => selectLayoutNode(sample(dump([search(), search()])), field), /ambiguous/);
  assert.throws(() => sample(dump([search()]), { windowId: '999' }), /IDs disagree/);
});

test('replays row gap, center alignment and non-overlap with one px-to-vp conversion', () => {
  const current = sample(dump([search()]));
  const gap = check({ kind: 'gap', a: field, b: submit, axis: 'x', branch: 'row', expected: 5, tolerancePx: 1 }, current);
  assert.equal(gap.verdict, 'PASS');
  assert.ok(Math.abs(gap.actual.valueVp - 18 / density) < 1e-10);
  assert.deepEqual(gap.evidenceRefs, ['tree', 'window']);
  assert.equal(check({ kind: 'gap', a: field, b: submit, axis: 'x', expected: 10, tolerancePx: 1 }, current).verdict, 'FAIL');
  assert.equal(check({ kind: 'align', a: field, b: submit, axis: 'y', expected: 0 }, current).verdict, 'PASS');
  assert.equal(check({ kind: 'nonOverlap', a: field, b: back, expected: { maxOverlapAreaVp2: 0 } }, current).actual.overlapAreaVp2, 0);
  assert.equal(check({ kind: 'gap', a: field, b: submit, axis: 'x', branch: 'stacked', expected: 5 }, current).verdict, 'NOT_RUN');
});

test('admits only the search action from the submit button native description', () => {
  const step = {id:'submit-search', op:'click', target:submit, from:'ready'};
  const ready = description => sample(dump([node(submit, [10, 20, 50, 40], {clickable:'true', description})]));
  assert.deepEqual(requestedOperation(step, {ready:ready('搜索')}), {op:'click', x:140, y:175});
  assert.throws(() => requestedOperation(step, {ready:ready('停止搜索')}), /no enabled search semantics/);
  const unrecognized = ready('private button description');
  assert.throws(() => requestedOperation(step, {ready:unrecognized}), /no enabled search semantics/);
  assert.doesNotMatch(JSON.stringify(unrecognized), /private button description/);
});

test('Phase 1 search reads the actual visible Stop child on the normal search button', () => {
  const ready = label => sample(dump([node(submit, [10, 20, 50, 40], {clickable:'true',
    children:[node('', [20, 22, 40, 38], {type:'Text',originalText:label})]})]));
  assert.equal(selectLayoutNode(ready('停止'), submit).searchSemantic,'stop');
  assert.equal(selectLayoutNode(ready('搜索'), submit).searchSemantic,'search');
  assert.equal(selectLayoutNode(ready('synthetic unknown fixture content'), submit).searchSemantic,undefined);
});

test('Phase 1 search Task retry accepts only the unique enabled button inside the named native sheet', () => {
  const title = label => node('', [10,100,50,110], {type:'Text',originalText:label});
  const button = (extra = {}) => node('', [10,130,70,150], {type:'Button',clickable:'true',...extra,
    children:[node('', [12,132,68,148], {type:'Text',originalText:'重试未完成的书源'})]});
  const sheet = children => node('', [0,0,100,200], {type:'SheetWrapper',children:[
    node('', [0,90,100,200], {type:'SheetPage',children}),
  ]});
  const options = {observeSearchTaskRetry:true};
  const selector = 'reader-search-task-retry';
  const current = sample(dump([button(),sheet([title('搜索进度'),button()])]), options);
  assert.equal(selectLayoutNode(current, selector).path,'0/1/0/1');
  assert.deepEqual(current.nodes.flatMap(item => item.sheetTitle ? [item.sheetTitle] : []),['搜索进度']);
  assert.doesNotMatch(JSON.stringify(current),/重试未完成的书源/u);
  assert.throws(() => selectLayoutNode(sample(dump([sheet([title('筛选'),button()])]),options),selector),/missing/);
  assert.throws(() => selectLayoutNode(sample(dump([sheet([title('搜索进度'),button(),button()])]),options),selector),/missing/);
  assert.throws(() => selectLayoutNode(sample(dump([sheet([title('搜索进度'),button({enabled:'false'})])]),options),selector),/missing/);
  const recovered = children => sample(dump(children), {...options,observeSearchTaskSheet:true});
  const settled = recovered([sheet([title('搜索进度')])]);
  assert.equal(selectLayoutNode(settled,'reader-search-task-sheet').type,'SheetPage');
  assert.throws(() => selectLayoutNode(settled,selector),/missing/);
  const duplicateRetry = recovered([sheet([title('搜索进度'),button(),button()])]);
  assert.equal(duplicateRetry.nodes.filter(item => item.alias === selector).length,2);
  assert.throws(() => selectLayoutNode(recovered([sheet([title('搜索进度')]),sheet([title('搜索进度')])]),
    'reader-search-task-sheet'),/missing/);
});

test('reads an enabled search button’s direct native text child without accepting a stop action', () => {
  const step = {id:'submit-search', op:'click', target:submit, from:'ready'};
  const ready = (label, attributes = {}, childAttrs = {}) => sample(dump([node(submit, [10, 20, 50, 40], {
    clickable:'true', ...attributes,
    children:[node('', [20, 25, 40, 36], {type:'Text', originalText:label, ...childAttrs})],
  })]));
  assert.deepEqual(requestedOperation(step, {ready:ready('搜索')}), {op:'click', x:140, y:175});
  assert.throws(() => requestedOperation(step, {ready:ready('停止搜索')}), /no enabled search semantics/);
  assert.throws(() => requestedOperation(step, {ready:ready('搜索', {enabled:'false'})}), /no admitted native tap point/);
  assert.throws(() => requestedOperation(step, {ready:ready('搜索', {}, {hostWindowId:'other'})}), /no enabled search semantics/);
  assert.throws(() => requestedOperation(step, {ready:ready('搜索', {description:'停止搜索'})}), /no enabled search semantics/);
});

test('measures ancestor containment and distinguishes clipping configuration and effect', () => {
  const assertion = { a: content, b: clip };
  const config = { ...assertion, kind: 'clip', mode: 'configuration', expected: { enabled: true } };
  const effect = { ...assertion, kind: 'clip', mode: 'effect', expected: { minClippedAreaVp2: 0 }, tolerancePx: 1 };
  const contain = { ...assertion, kind: 'contain', expected: { maxOverflowVp: 0 } };
  const stable = sample(dump([reading()]), { transitionId: 'open-3' });
  const overrun = sample(dump([reading({ overrun: true })]), { transitionId: 'open-3' });
  assert.equal(check(contain, stable).verdict, 'PASS');
  assert.equal(check(contain, overrun).actual.overflowVp.right, 10);
  assert.equal(check(contain, overrun).verdict, 'FAIL');
  assert.equal(check(config, stable).verdict, 'PASS');
  assert.equal(check({ ...config, expected: { enabled: true, shape: 'roundedRect' } }, stable).verdict, 'NOT_RUN');
  assert.equal(check(effect, stable).verdict, 'NOT_RUN');
  assert.equal(check(effect, overrun).verdict, 'PASS');
  assert.equal(check(effect, overrun).actual.clippedAreaVp2, 300);
  assert.equal(check(effect, { ...overrun, transitionId: undefined }).verdict, 'NOT_RUN');
  const uncut = sample(dump([reading({ clipEnabled: false, overrun: true, hideOverrun: false })]),
    { transitionId: 'open-3' });
  assert.equal(check(config, uncut).verdict, 'FAIL');
  assert.equal(check(effect, uncut).verdict, 'FAIL');
});

test('separates window clipping, opacity and zero area, and uses exact measured round-rect geometry', () => {
  const off = 'reader-offscreen';
  const zero = 'reader-zero';
  const ring = 'reader-round-clip';
  const probe = 'reader-round-probe';
  const current = sample(dump([
    node(off, [0, 210, 15, 230]),
    node(zero, [0, 20, 0, 20]),
    node(ring, [10, 20, 20, 30], { clip: 'true', children: [node(probe, [10, 20, 20, 30])] }),
  ]), { clipShapes: [{ id: ring, shape: 'roundedRect', radiusVp: 2, source: 'debug-frame' }] });
  const visibility = { kind: 'visibleFraction', basis: 'rectangular', expected: { minFraction: 1 } };
  const offscreen = check({ ...visibility, a: off }, current);
  assert.equal(offscreen.actual.opacity, 1);
  assert.equal(offscreen.actual.fraction, 0);
  assert.equal(offscreen.verdict, 'FAIL');
  assert.equal(check({ ...visibility, a: zero }, current).verdict, 'NOT_RUN');
  assert.equal(check({ ...visibility, a: probe }, current).actual.fraction, 1);
  const rounded = check({ ...visibility, a: probe, basis: 'rounded' }, current);
  assert.equal(rounded.verdict, 'FAIL');
  assert.ok(Math.abs(rounded.actual.visibleAreaVp2 - (100 - 16 + 4 * Math.PI)) < 1e-10);
  assert.equal(check({ ...visibility, a: probe, basis: 'rounded', acceptedSources: ['native-tree'] }, current).verdict, 'NOT_RUN');
});

test('constrains visible fraction by native node and window readback bounds', () => {
  const box = [0, 20, 20, 40];
  const tree = dump([node(submit, box, {bounds: bounds(0, 20, 10, 40)})]);
  const visibility = { kind:'visibleFraction', basis:'rectangular', a:submit, expected:{minFraction:1} };
  const measured = check(visibility, sample(tree));
  assert.equal(measured.verdict, 'FAIL');
  assert.equal(measured.actual.fraction, 0.5);
  assert.equal(measured.actual.sourceAreaVp2, 400);
  assert.deepEqual(measured.actual.visibleReadbackVp, {left:0, top:20, width:10, height:20});

  const partialWindow = dump([node(submit, box)]);
  partialWindow.children[0].attributes.bounds = bounds(0, 30, 100, 200);
  assert.equal(check(visibility, sample(partialWindow)).actual.fraction, 0.5);

  const missing = check(visibility, sample(dump([node(submit, box, {bounds: ''})])));
  assert.equal(missing.verdict, 'NOT_RUN');
  assert.match(missing.reason, /Native visible bounds are unavailable/);
});

test('uses window-local IME geometry for floating and bottom-docked keyboards and rejects old IME revisions', () => {
  const float = { left: 55, top: 10, width: 12, height: 20 };
  const dock = { left: 0, top: 180, width: 100, height: 20 };
  const current = sample(dump([search()]), { report: report({ rects: [float, float, dock] }) });
  const assertion = { kind: 'keyboardAvoidance', a: field, expected: { maxOverlapAreaVp2: 0 } };
  const fieldClear = check(assertion, current);
  assert.equal(fieldClear.verdict, 'PASS');
  assert.equal(fieldClear.actual.bottomGapVp, 140);
  const button = check({ ...assertion, a: submit }, current);
  assert.equal(button.verdict, 'FAIL');
  assert.ok(button.actual.overlapAreaVp2 > 117 && button.actual.overlapAreaVp2 <= 120);
  const visibility = check({ kind: 'visibleFraction', a: submit, basis: 'rectangular',
    expected: { minFraction: 1 }, includeKeyboard: true }, current);
  assert.equal(visibility.verdict, 'FAIL');
  assert.equal(check(assertion, sample(dump([search()]), {
    report: report({ rects: [float], keyboardRevision: 7 }),
  })).verdict, 'NOT_RUN');
});

test('compares node displacement relative to the same anchor with verified continuity', () => {
  const comparison = { kind: 'relativeDelta', a: field, anchor: bar, baseline: 'baseline', expected: { dx: 0, dy: 0 }, tolerancePx: 1 };
  const before = sample(dump([search(20)]), { continuityId: 'search-2' });
  const after = sample(dump([search(50)]), { continuityId: 'search-2' });
  assert.equal(check(comparison, after, before).actual.dy, 0);
  assert.equal(check(comparison, after, before).verdict, 'PASS');
  const moved = pixels => ({ ...after, nodes: after.nodes.map(item => item.id === field ?
    {...item, rectPx:{...item.rectPx, left:item.rectPx.left + pixels}} : item) });
  const atTolerance = check(comparison, moved(1), before);
  assert.equal(atTolerance.actual.dx, 1 / density);
  assert.equal(atTolerance.verdict, 'PASS');
  assert.equal(check(comparison, moved(2), before).verdict, 'FAIL');
  assert.equal(check(comparison, sample(dump([search(50, 3)])), before).verdict, 'FAIL');
  assert.equal(check(comparison, { ...after, instanceId: 'different' }, before).verdict, 'NOT_RUN');
  const newMount = { ...after, nodes: after.nodes.map(item => item.id === field ? { ...item, key: '40' } : item) };
  assert.equal(check(comparison, newMount, before).verdict, 'NOT_RUN');
  assert.equal(check({ ...comparison, sameContinuity: true }, newMount, before).verdict, 'PASS');
});

test('selects a unique local public fixture card and excludes arbitrary text and book IDs', () => {
  const publicLeaf = node('', [10, 18, 30, 23], { text: title });
  const card = (sourceId, bookId) => node(`reader-shelf-book-action:[1,"${sourceId}","${bookId}",false]`, [10, 10, 60, 60], {
    clickable: 'true',
    description: `${title}，private author，0%`,
    children: [publicLeaf, publicLeaf, node('', [11, 10, 12, 12], { text: 'private leaf' })],
  });
  const online = card('remote', 'private remote identifier');
  const local = card('local', 'private local identifier');
  const current = sample(dump([online, local]), { publicBookTitle: title });
  const book = selectLayoutNode(current, { publicBookTitle: title });
  assert.equal(book.localBookAction, true);
  assert.equal(book.path, '0/1');
  assert.deepEqual(layoutTapPoint(book), { x: 157, y: 192 });
  assert.doesNotMatch(JSON.stringify(current), /private/);
  assert.throws(() => selectLayoutNode(sample(dump([online]), { publicBookTitle: title }), { publicBookTitle: title }), /missing/);
  assert.throws(() => selectLayoutNode(sample(dump([local, local]), { publicBookTitle: title }), { publicBookTitle: title }), /ambiguous/);
});

test('Phase 1 search resolves distinct allowlisted local book titles without retaining book keys', () => {
  const secondTitle = 'PhaseOneCedar7314 Public Fixture';
  const result = (owner, privateKey, label) => node('reader-search-result:' + JSON.stringify([2, 8, owner + ':' + privateKey]), [10, 10, 60, 60], {
    clickable: 'true',
    children: [node('', [10, 18, 30, 23], { text: label })],
  });
  const a = result('local', 'private A book key', title);
  const b = result('local', 'private B book key', secondTitle);
  const remote = result('online', 'private remote key', secondTitle);
  const options = { publicBookTitle: title, publicBookTitles: { b: secondTitle } };
  const current = sample(dump([a, b, remote]), options);
  assert.equal(selectLayoutNode(current, 'reader-search-public-local-result').path, '0/0');
  assert.equal(selectLayoutNode(current, 'reader-search-public-local-result-b').path, '0/1');
  assert.doesNotMatch(JSON.stringify(current), /private|PhaseOneCedar7314/u);
  assert.throws(() => selectLayoutNode(sample(dump([a, remote]), options), 'reader-search-public-local-result-b'), /missing/);
  assert.throws(() => selectLayoutNode(sample(dump([a, b, b]), options), 'reader-search-public-local-result-b'), /ambiguous/);
});

test('source read surfaces normalize only scoped native state witnesses', () => {
  const title = (value, options) => node('',[3,7,30,11],{type:'Text',originalText:value,...options});
  const progress = () => node('',[4,4,12,10],{type:'LoadingProgress'});
  const read = nodes => sample(dump(nodes),{observeSourceRead:true});
  const loading = 'reader-source-loading-progress';
  const failure = 'reader-source-read-failure-title';
  const empty = 'reader-source-empty-library-title';
  const recovery = 'reader-source-recovery-message';
  for (const host of ['reader-source-empty-state','reader-source-filter-block']) {
    const nodes = [node(host,[0,0,100,70],{children:[progress()]})];
    assert.equal(selectLayoutNode(read(nodes),{id:loading,ancestors:[host]}).type,'LoadingProgress');
    assert.throws(() => selectLayoutNode(sample(dump(nodes)),loading),/missing/u);
  }
  const actualFailure = title('书源读取失败');
  const error = read([actualFailure,node('reader-source-empty-state',[0,0,100,70],{
    children:[actualFailure,title('暂无书源'),title('书源读取失败',{hostWindowId:'43'})],
  })]);
  assert.equal(selectLayoutNode(error,{id:failure,ancestors:['reader-source-empty-state']}).type,'Text');
  assert.equal(selectLayoutNode(error,{id:empty,ancestors:['reader-source-empty-state']}).type,'Text');
  assert.throws(() => selectLayoutNode(read([title('暂无书源')]),empty),/missing/u);
  assert.throws(() => selectLayoutNode(read([actualFailure,progress()]),failure),/missing/u);
  assert.throws(() => selectLayoutNode(read([progress()]),loading),/missing/u);
  const button = node('',[1,12,30,25],{type:'Button',children:[title('核对')]});
  const host = children => node('reader-source-pending-recovery',[0,0,100,70],{children});
  assert.throws(() => selectLayoutNode(read([host([button,title('白屏',{visible:'false'})])]),recovery),/missing/u);
  const notice = read([host([button,title('Synthetic private recovery details')])]);
  assert.equal(selectLayoutNode(notice,{id:recovery,ancestors:['reader-source-pending-recovery']}).type,'Text');
  assert.ok(!JSON.stringify(notice).includes('Synthetic private recovery details'));
});

test('source group option order uses actionable native aliases without group labels', () => {
  const host = 'reader-source-group-panel';
  const firstAlias = 'reader-source-group-option-1';
  const option = (generation, name, top) => node(`source-group:${generation}:focus:option:${name}`,[5,top,90,top+30],{
    type:'Button',clickable:'true',text:name,
  });
  const menu = (generation) => node(host,[0,10,100,130],{children:[
    node(`source-group:${generation}:focus:selected`,[5,10,90,40],{type:'Button',clickable:'true'}),
    option(generation,'fixture-first-group',40),
    option(generation,'公开分组名称',70),
  ]});
  const captured = sample(dump([menu(17)]));
  assert.equal(selectLayoutNode(captured,{id:firstAlias,ancestors:[host]}).id,null);
  assert.equal(selectLayoutNode(captured,'reader-source-group-option-2').rectPx.top,315);
  assert(!JSON.stringify(captured).includes('fixture-first-group'));
  assert(!JSON.stringify(captured).includes('公开分组名称'));
  assert.throws(() => selectLayoutNode(sample(dump([menu(17),menu(18)])),firstAlias),/ambiguous/u);
});

test('Phase 1 search rechecks fully visible enabled submits without relaxing the visible area', () => {
  const exposed = (enabled, clipped) => sample(dump([node(submit, [20, 20, 90, 40], {
    enabled, bounds: clipped ? bounds(20, 20, 89, 40) : bounds(20, 20, 90, 40),
  })]));
  const rule = {kind:'visibleFraction', a:submit, basis:'rectangular', expected:{minFraction:1, enabled:true}};
  assert.equal(check(rule, exposed('true', false)).verdict, 'PASS');
  assert.equal(check(rule, exposed('false', false)).verdict, 'FAIL');
  assert.equal(check(rule, exposed('true', true)).verdict, 'FAIL');
  assert.equal(check(rule, exposed(null, false)).verdict, 'NOT_RUN');
});

test('Phase 1 search history matches only the exact public word on the newest native chip', () => {
  const alias='reader-search-history-public-item-0';
  const chip=(index,label)=>node('reader-search-history-item-'+index,[20,25,70,45],{type:'Button',clickable:'true',
    children:[node('',[25,28,64,43],{type:'Text',originalText:label})]});
  const publicWord='PhaseOneCedar7314';
  const actual=sample(dump([chip(0,publicWord),chip(1,'synthetic other history')]),{publicHistoryWord:publicWord});
  assert.equal(selectLayoutNode(actual,alias).id,'reader-search-history-item-0');
  assert.doesNotMatch(JSON.stringify(actual),/PhaseOneCedar7314|synthetic other history/u);
  const wrong=sample(dump([chip(0,'synthetic other history'),chip(1,publicWord)]),{publicHistoryWord:publicWord});
  assert.throws(()=>selectLayoutNode(wrong,alias),/missing/u);
});

test('directory editor uses the measured local fixture field under the Directory module', () => {
  const moduleId = 'reader-control-module-directory';
  const editor = { id:'reader-control-directory-query-directory', ancestors:[moduleId] };
  const measured = node(`reader-control-directory-query:local:${title}:13:directory`, [10,20,80,40],
    { type:'TextInput', clickable:'true', focused:'true' });
  const tree = dump([node(moduleId, [5,5,95,95], {children:[
    measured,
    node(`reader-control-directory-query:remote:${title}:13:directory`, [10,50,50,60], {type:'TextInput'}),
    node('reader-control-directory-query:local:different book:13:directory', [10,70,50,85], {type:'TextInput'}),
  ]})]);
  const normalized = sample(tree, {publicBookTitle:title});
  assert.equal(selectLayoutNode(normalized, editor).focused, true);
  assert.equal(normalized.nodes.filter(item => item.alias === editor.id).length, 1);
  assert.throws(() => selectLayoutNode(sample(tree), editor), /missing/);
  assert.throws(() => selectLayoutNode(sample(dump([measured]), {publicBookTitle:title}), editor), /missing/);
});

test('reading Search aliases only the public fixture editor and first native result', () => {
  const moduleId = 'reader-control-module-search';
  const fieldId = 'reader-control-search-field';
  const listId = 'reader-control-search-results';
  const editorAlias = 'reader-control-search-editor';
  const firstAlias = 'reader-control-search-first-result';
  const input = (id = 'reader-content-search-input-4') => node(id,[10,20,80,40],{
    type:'TextInput',focused:'true',originalText:'private synthetic query',
  });
  const row = (id,type = 'Button') => node(id,[10,65,80,85],{type,clickable:'true',text:'private synthetic result'});
  const tree = dump([
    node(moduleId,[5,5,95,95],{children:[
      node(fieldId,[8,15,90,45],{children:[input()]}),
      node(listId,[8,50,90,90],{type:'List',children:[
        row('reader-control-search-result:2:0'),row('reader-control-search-result:2:1'),
        row('reader-control-search-result:2:0','Text'),row('reader-control-search-result:0:0'),
      ]}),
    ]}),
    input('reader-content-search-input-7'),row('reader-control-search-result:3:0'),
  ]);
  const actual = sample(tree,{observeReadingSearchResults:true,report:report({rects:[{left:0,top:100,width:100,height:100}]})});
  assert.equal(selectLayoutNode(actual,editorAlias).id,'reader-content-search-input-4');
  assert.equal(selectLayoutNode(actual,firstAlias).id,'reader-control-search-result:2:0');
  assert.doesNotMatch(JSON.stringify(actual),/private synthetic/u);
  assert.throws(() => selectLayoutNode(sample(tree),firstAlias),/missing/u);
  assert.throws(() => selectLayoutNode(sample(tree),editorAlias),/missing/u);
  const locate = step => requestedOperation({id:'ordinary-input',from:'prior',...step},{prior:actual},{inputs:{a:'桥墩和屋檐'}});
  assert.equal(locate({op:'inputText',target:editorAlias,inputRole:'a'}).text,'桥墩和屋檐');
  assert.equal(locate({op:'click',target:firstAlias}).op,'click');

  const definition = loadStructureDefinition();
  const rule = definition.structureRules.find(item => item.id === 'reading.search-quick-results');
  assert.deepEqual(rule.requires,['reading.search-quick']);
  const assess = capture => evaluateStructure(rule,capture,definition.structureSelectors).verdict;
  const endpoint = {...actual,captureComplete:true};
  assert.equal(assess(endpoint),'PASS');
  assert.equal(assess({...endpoint,nodes:actual.nodes.filter(item => item.alias !== firstAlias)}),'FAIL');
  assert.equal(assess({...endpoint,captureComplete:false}),'NOT_RUN');
});
