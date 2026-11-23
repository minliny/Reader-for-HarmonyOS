import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const args = process.argv.slice(2);
const output = args.find(arg => arg.startsWith('--evidence-path='))?.slice('--evidence-path='.length);
if (output) assert.ok(output.startsWith('.reader-artifacts/') && !output.includes('..'));
const selected = selectContractCases({
  'rules-drafts': 'Actual four Rules editors prefill/current field and Toggle values, unique identities, choice state, typed save and old-draft/page callback retirement.',
  'rules-rows': 'Actual same-ID Rules row values and edit/refresh actions consume current DTO; removed entities reject retained native actions.',
  'discover-pagination': 'Actual retained Discover pagination native eligibility/primary/page/loading/accepted actions; current L0 admission remains explicit.',
}, { argv: args.filter(arg => !arg.startsWith('--evidence-path=')) });

if (selected.length) {
  const { foundationControls } = await import('./lib/reader-foundation-control-probe.mjs');
  const { switchControls } = await import('./lib/reader-switch-control-probe.mjs');
  const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
  const { boundedMembers } = await import('./lib/bounded-surface-sdk-probe.mjs');
  const { selectedProductionValues } = await import('./lib/selected-production-methods.mjs');
  const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
  const { isReaderProductSurfaceEnabled, READER_PRODUCT_PROFILE } = await import('../entry/src/main/ets/app/ReaderProductScope.ts');
  const root = new URL('../', import.meta.url), read = path => readFileSync(new URL(path, root), 'utf8');
  const rulesPath = 'entry/src/main/ets/features/settings/ui/RulesManagementPage.ets';
  const discoverPath = 'entry/src/main/ets/features/discover/ui/DiscoverPage.ets';
  const rulesSource = read(rulesPath), discoverSource = read(discoverPath);
  const rulesDefaults = selectedProductionValues(new URL('entry/src/main/ets/features/settings/application/RulesManagementOrchestrator.ets', root), ['EMPTY_RULES_MANAGEMENT_SNAPSHOT']);
  const discoverDefaults = selectedProductionValues(new URL('entry/src/main/ets/features/discover/application/DiscoverOrchestrator.ets', root), ['EMPTY_DISCOVER_PRESENTATION']);
  const { ts, options } = installedEtsCompiler();
  const rule = { id: 11, name: '替换-v1', pattern: 'pattern-v1', replacement: 'replacement-v1', isEnabled: false, isRegex: false, order: 8 };
  const txt = { id: 12, name: '目录-v1', rule: 'chapter-v1', example: '第1章', enable: false, serialNumber: 9 };
  const dict = { name: '词典主键', urlRule: 'https://dict.test/v1/{{key}}', showRule: 'show-v1', enabled: false, sortNumber: 10 };
  const subscription = { id: 13, name: '订阅-v1', url: 'https://sub.test/v1', type: 2, autoUpdate: true, customOrder: 11, update: 19 };
  const initialRules = () => ({ ...rulesDefaults.EMPTY_RULES_MANAGEMENT_SNAPSHOT,
    replaceRules: [{ ...rule }], txtTocRules: [{ ...txt }], dictRules: [{ ...dict }], subscriptions: [{ ...subscription }] });
  const walk = owner => [owner, ...[...owner.children.values()].flatMap(walk)];
  const nodes = owner => walk(owner).flatMap(actor => [...actor.nodes.values()]);
  function buildFragment(source, name, body) {
    const tree = ts.createSourceFile(name + '.ets', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
    assert.deepEqual(tree.parseDiagnostics, []);
    const component = tree.statements.find(node => node.name?.getText(tree) === name);
    const build = component.members.find(node => node.name?.getText(tree) === 'build');
    return source.slice(0, build.body.getStart(tree)) + `{ ${body} }` + source.slice(build.body.end);
  }

  function rulesFixture(source = rulesSource) {
    const controls = foundationControls(), toggles = switchControls({ properties: controls.properties });
    const fragment = buildFragment(source, 'RulesManagementPage',
      'Column() { this.replaceCard(); this.txtTocCard(); this.dictCard(); this.subscriptionCard(); }');
    const excluded = new Set(['pageHeader', 'pageContent', 'statusCard', 'recoveryAction', 'bundleCard']);
    const hooks = { ...controls.hooks, ...toggles.hooks,
      childSources: { ...controls.hooks.childSources, ...toggles.hooks.childSources }, initialParams: { snapshot: initialRules() } };
    const probe = createReaderBuilderProbe(fragment, boundedMembers(fragment).filter(name => !excluded.has(name)), {
      ...controls.dependencies, ...toggles.dependencies, ...rulesDefaults, nextRulesDraftOpening: 0,
      registerReaderFonts() {}, LengthMetrics: { vp: value => value },
    }, hooks);
    const owner = probe.owner, calls = [];
    Object.assign(owner, { onSaveReplace: value => calls.push(['replace', value]), onSaveTxtToc: value => calls.push(['txt', value]),
      onSaveDict: value => calls.push(['dict', value]), onSaveSubscription: value => calls.push(['subscription', value]),
      onDeleteReplace: id => calls.push(['delete-replace', id]), onDeleteTxtToc: id => calls.push(['delete-txt', id]),
      onDeleteDict: name => calls.push(['delete-dict', name]), onDeleteSubscription: id => calls.push(['delete-subscription', id]),
      onRefreshSubscription: value => calls.push(['refresh', value]) });
    owner.aboutToAppear(); owner.initialRender();
    const fields = () => walk(owner).filter(actor => actor instanceof controls.dependencies.ReaderFormField);
    const switches = () => walk(owner).filter(actor => actor instanceof toggles.dependencies.ReaderToggle);
    const buttons = () => walk(owner).filter(actor => actor instanceof controls.dependencies.ReaderButton);
    const offsets = { replace: [0, 4], txt: [4, 8], dict: [8, 12], subscription: [12, 15] };
    const switchOffsets = { replace: [0, 2], txt: [2, 3], dict: [3, 4], subscription: [4, 5] };
    const current = (all, kind, fallback) => typeof owner.draftKey === 'function' ?
      all.filter(actor => actor.inputIdentity.startsWith(owner.draftKey(kind) + ':')) : all.slice(...fallback[kind]);
    const native = actor => [...actor.nodes.values()].findLast(node => ['Button', 'TextInput', 'Toggle'].includes(node.type));
    const flush = () => controls.properties.flush();
    const publish = patch => { owner.updateStateVars({ snapshot: { ...owner.snapshot, ...patch } }); flush(); };
    return { owner, calls, controls, fields, switches, buttons, native, flush, publish,
      fieldsFor: kind => current(fields(), kind, offsets), switchesFor: kind => current(switches(), kind, switchOffsets),
      lastButton: label => buttons().findLast(button => button.label === label) };
  }

  function rulesDraftScenario(source = rulesSource) {
    const f = rulesFixture(source), o = f.owner;
    assert.equal(new Set(f.switches().map(actor => f.native(actor).id)).size, 5, 'five native Toggle target IDs are distinct');
    o.editReplace({ ...rule }); f.flush();
    assert.deepEqual(f.fieldsFor('replace').map(field => field.text), [rule.name, rule.pattern, rule.replacement, '8'],
      'current replacement prefill reaches actual fields');
    assert.deepEqual(f.switchesFor('replace').map(actor => actor.value), [false, false]);
    assert.ok(f.lastButton('保存替换规则'), 'current editor mode reaches actual save label');
    o.editTxt({ ...txt }); o.editDict({ ...dict }); o.editSubscription({ ...subscription }); f.flush();
    assert.deepEqual(f.fieldsFor('txt').map(field => field.text), [txt.name, txt.rule, txt.example, '9']);
    assert.deepEqual(f.fieldsFor('dict').map(field => field.text), [dict.name, dict.urlRule, dict.showRule, '10']);
    assert.deepEqual(f.fieldsFor('subscription').map(field => field.text), [subscription.name, subscription.url, '11']);
    assert.deepEqual(f.switchesFor('txt').map(actor => actor.value), [false]);
    assert.deepEqual(f.switchesFor('dict').map(actor => actor.value), [false]);
    assert.deepEqual(f.switchesFor('subscription').map(actor => actor.value), [true]);
    const currentSwitches = ['replace', 'txt', 'dict', 'subscription'].flatMap(kind => f.switchesFor(kind));
    assert.equal(new Set(currentSwitches.map(actor => actor.inputIdentity)).size, 5, 'all five actual Toggle identities are distinct');
    const name = f.fieldsFor('replace')[0];
    f.native(name).onChange('本地新草稿'); f.flush();
    assert.equal(o.replaceName, '本地新草稿'); assert.equal(name.text, '本地新草稿', 'current typed draft reaches retained actual field');
    const toggle = f.switchesFor('replace')[0];
    for (const value of [true, false]) {
      f.native(toggle).onChange(value); f.flush();
      assert.equal(o.replaceEnabled, value); assert.equal(toggle.value, value);
      assert.equal(f.native(toggle).create.isOn, value, 'current local Toggle value reaches actual native constructor');
      assert.equal(f.switchesFor('replace')[0], toggle, 'ordinary draft toggles keep the shared owner');
    }
    return { f, o, name };
  }

  const results = {};
  if (selected.includes('rules-drafts')) {
    const { f, o, name } = rulesDraftScenario();
    const oldChange = name.onTextChange;
    o.editReplace({ ...rule, id: 22, name: '另一条规则', isEnabled: true }); f.flush();
    oldChange('旧输入迟到'); f.flush();
    assert.equal(o.replaceName, '另一条规则', 'old draft input cannot overwrite the current editor');
    const typeButtons = ['书源', 'RSS 源', '替换规则'].map(label => f.lastButton(label));
    for (const [index, button] of typeButtons.entries()) {
      f.native(button).onClick(); f.flush();
      assert.equal(o.subType, index);
      assert.deepEqual(typeButtons.map(actor => actor.primary), [0, 1, 2].map(value => value === index));
      assert.deepEqual(typeButtons.map(actor => f.native(actor).accessibilitySelected), [0, 1, 2].map(value => value === index));
    }
    f.native(f.lastButton('保存替换规则')).onClick();
    assert.deepEqual(f.calls.at(-1), ['replace', { id: 22, name: '另一条规则', pattern: rule.pattern,
      replacement: rule.replacement, isEnabled: true, isRegex: false, order: 8 }]);
    f.publish({ busy: true, ruleMutation: { blocked: true }, receipt: { receipt: { confirmation: 'unknown' } } });
    const currentName = f.fieldsFor('replace')[0], currentToggle = f.switchesFor('replace')[0];
    f.native(currentName).onChange('未决期间保留草稿'); f.native(currentToggle).onChange(false); f.flush();
    assert.equal(o.replaceName, '未决期间保留草稿'); assert.equal(o.replaceEnabled, false);
    const before = f.calls.length;
    f.native(f.lastButton('保存替换规则')).onClick(); assert.equal(f.calls.length, before);
    o.aboutToDisappear(); currentName.onTextChange('退场迟到'); assert.equal(o.replaceName, '未决期间保留草稿');
    // The actual SDK recorder retains old branches. The page's own captured
    // draft identity must reject the old callback even in that stronger case.
    let oldScope = rulesSource;
    const tree = ts.createSourceFile('RulesManagementPage.ets', oldScope, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
    const page = tree.statements.find(node => node.name?.getText(tree) === 'RulesManagementPage');
    const guard = page.members.find(node => node.name?.getText(tree) === 'draftIsCurrent');
    assert.ok(guard);
    oldScope = oldScope.slice(0, guard.body.getStart(tree)) + '{ return this.mounted; }' + oldScope.slice(guard.body.end);
    const stale = rulesDraftScenario(oldScope), retained = stale.name.onTextChange;
    stale.o.editReplace({ ...rule, id: 23, name: '新编辑器' }); stale.f.flush(); retained('旧输入迟到');
    assert.throws(() => assert.equal(stale.o.replaceName, '新编辑器'), /AssertionError/, 'missing draft identity guard is behaviorally rejected');
    const captured = rulesSource.replace('private input(value: () => string,', 'private input(value: string,')
      .replace("specId: 'rules-input', text: value(), placeholder", "specId: 'rules-input', text: value, placeholder")
      .replace(/this\.input\(\(\): string => (this\.\w+),/g, 'this.input($1,');
    assert.notEqual(captured, rulesSource);
    assert.throws(() => rulesDraftScenario(captured), /current typed draft reaches retained actual field/,
      'cached primitive input value is behaviorally rejected');
    const colliding = rulesSource.replace('inputIdentity: `${draftKey}:${label}`',
      'inputIdentity: `${label}:${this.replaceId}:${this.txtId}:${this.dictName}:${this.subId}`');
    assert.notEqual(colliding, rulesSource);
    const duplicateTargets = rulesFixture(colliding);
    assert.throws(() => assert.equal(new Set(duplicateTargets.switches().map(actor => duplicateTargets.native(actor).id)).size, 5),
      /AssertionError/, 'historical native Toggle target ID collision is rejected');
    results['rules-drafts'] = { editors: 4, fields: 15, uniqueToggleIdentities: 5, controlledToggleUpdates: 2,
      choiceUpdates: 3, currentSaveDraft: true, pendingLocalDraftPolicy: true, oldDraftAndExitRejected: true, oldScopeNegativeRejected: true, primitiveInputNegativeRejected: true, duplicateNativeIDNegativeRejected: true };
    recordContractCasePass('rules-drafts');
  }

  function rowScenario(source = rulesSource) {
    const f = rulesFixture(source), edits = f.buttons().filter(button => button.label === '编辑');
    const refresh = f.lastButton('拉取');
    const updated = { ...rule, name: '替换-v2', pattern: 'pattern-v2', replacement: 'replacement-v2' };
    f.publish({ replaceRules: [updated], txtTocRules: [{ ...txt, name: '目录-v2', rule: 'chapter-v2' }],
      dictRules: [{ ...dict, urlRule: 'https://dict.test/v2/{{key}}' }],
      subscriptions: [{ ...subscription, name: '订阅-v2', url: 'https://sub.test/v2', type: 1 }] });
    assert.ok(nodes(f.owner).some(node => node.type === 'Text' && node.create === '替换-v2'), 'same-ID row reads current title');
    assert.ok(nodes(f.owner).some(node => node.type === 'Text' && node.create === 'chapter-v2'));
    assert.ok(nodes(f.owner).some(node => node.type === 'Text' && node.create === 'https://dict.test/v2/{{key}}'));
    assert.ok(nodes(f.owner).some(node => node.type === 'Text' && node.create === 'RSS 源 · https://sub.test/v2'));
    edits.forEach((button, index) => assert.equal(f.buttons().filter(value => value.label === '编辑')[index], button));
    f.native(edits[0]).onClick(); f.flush();
    assert.equal(f.owner.replaceName, '替换-v2', 'retained row edit dispatches current DTO');
    f.native(edits[1]).onClick(); f.native(edits[2]).onClick(); f.native(edits[3]).onClick(); f.flush();
    assert.equal(f.owner.txtRule, 'chapter-v2'); assert.equal(f.owner.dictUrl, 'https://dict.test/v2/{{key}}');
    assert.equal(f.owner.subType, 1); assert.equal(f.owner.subUrl, 'https://sub.test/v2');
    f.native(refresh).onClick(); assert.deepEqual(f.calls.at(-1), ['refresh', f.owner.snapshot.subscriptions[0]]);
    return { f, edits, refresh };
  }
  if (selected.includes('rules-rows')) {
    const { f, edits, refresh } = rowScenario();
    const before = f.calls.length, draft = f.owner.replaceName;
    f.publish({ replaceRules: [], txtTocRules: [], dictRules: [], subscriptions: [] });
    assert.ok([...edits, refresh].every(button => f.native(button).enabled === false));
    [...edits, refresh].forEach(button => f.native(button).onClick());
    assert.equal(f.calls.length, before); assert.equal(f.owner.replaceName, draft);
    assert.ok(nodes(f.owner).some(node => node.type === 'Text' && node.create === '替换规则（0）'), 'current collection count reaches heading');
    const staleDTO = rulesSource.replace('const current = this.currentReplace(rule.id);\n            if (current !== undefined) this.editReplace(current);',
      'this.editReplace(rule);');
    assert.notEqual(staleDTO, rulesSource);
    assert.throws(() => rowScenario(staleDTO), /retained row edit dispatches current DTO/,
      'captured same-ID entity is behaviorally rejected');
    results['rules-rows'] = { families: 4, retainedEditActors: 4, currentDTOEditAndRefresh: true, removedRejected: true, liveCount: true, staleDTONegativeRejected: true };
    recordContractCasePass('rules-rows');
  }

  function paginationScenario(source = discoverSource) {
    const controls = foundationControls();
    const members = ['presentation', 'mounted', 'onPresentationChanged', 'readFeedbackIdentity', 'lastReadFeedback',
      'paginationRow', 'pageAction'];
    if (source.includes('private pageActionAvailable(')) members.push('pageActionAvailable');
    const initial = { ...discoverDefaults.EMPTY_DISCOVER_PRESENTATION, hasNext: true };
    const owner = createReaderBuilderProbe(source, members, { ...controls.dependencies, ...discoverDefaults },
      { ...controls.hooks, initialParams: { presentation: initial } }).owner;
    const calls = [];
    Object.assign(owner, { mounted: true, onPreviousPage: () => calls.push('previous'), onNextPage: () => calls.push('next') });
    owner.paginationRow();
    const buttons = [...owner.children.values()].filter(actor => actor instanceof controls.dependencies.ReaderButton);
    assert.equal(buttons.length, 2);
    const native = button => [...button.nodes.values()].find(node => node.type === 'Button');
    const publish = patch => { owner.updateStateVars({ presentation: { ...owner.presentation, ...patch } }); controls.properties.flush(); };
    assert.deepEqual(buttons.map(button => native(button).enabled), [false, true]);
    publish({ page: 2, hasPrevious: true, hasNext: false });
    assert.deepEqual(buttons.map(button => native(button).enabled), [true, false], 'retained pagination consumes current availability');
    assert.deepEqual(buttons.map(button => button.primary), [true, false]);
    assert.ok(nodes(owner).some(node => node.type === 'Text' && node.create === '第 2 页'));
    native(buttons[0]).onClick(); native(buttons[1]).onClick(); assert.deepEqual(calls, ['previous']);
    publish({ loading: true }); assert.ok(buttons.every(button => native(button).enabled === false));
    native(buttons[0]).onClick(); assert.deepEqual(calls, ['previous']);
    publish({ loading: false, page: 1, hasPrevious: false, hasNext: true });
    native(buttons[1]).onClick(); assert.deepEqual(calls, ['previous', 'next']);
    owner.mounted = false; native(buttons[1]).onClick(); assert.deepEqual(calls, ['previous', 'next'], 'retired page cannot paginate');
    assert.equal(owner.children.size, 2, 'pagination children are retained');
    return { children: 2, availabilityUpdates: 3, acceptedDirections: calls };
  }
  if (selected.includes('discover-pagination')) {
    results['discover-pagination'] = paginationScenario();
    const stale = discoverSource.replace('private pageAction(previous: boolean) {',
      'private pageAction(previous: boolean, enabled: boolean) {')
      .replace('this.pageAction(true);', 'this.pageAction(true, this.presentation.hasPrevious);')
      .replace('this.pageAction(false);', 'this.pageAction(false, this.presentation.hasNext);')
      .replace('primary: this.pageActionAvailable(previous), actionEnabled: this.pageActionAvailable(previous)',
        'primary: enabled, actionEnabled: enabled');
    assert.notEqual(stale, discoverSource);
    assert.throws(() => paginationScenario(stale), /retained pagination consumes current availability/,
      'captured pagination eligibility is behaviorally rejected');
    results['discover-pagination'].primitiveAvailabilityNegativeRejected = true;
    assert.equal(READER_PRODUCT_PROFILE, 'l0'); assert.equal(isReaderProductSurfaceEnabled('discover'), false);
    results['discover-pagination'].admission = 'current l0, discover disabled';
    recordContractCasePass('discover-pagination');
  }

  const paths = [rulesPath, discoverPath, 'entry/src/main/ets/ui/controls/ReaderButton.ets',
    'entry/src/main/ets/ui/controls/ReaderFormField.ets', 'entry/src/main/ets/ui/controls/ReaderToggle.ets',
    'entry/src/main/ets/app/ReaderProductScope.ts', 'tools/test-builder-current-inputs.mjs',
    'tools/lib/reader-control-builder-probe.mjs', 'tools/lib/arkui-property-runtime-probe.mjs'];
  const report = { status: 'PASS', cases: selected, results,
    inputs: paths.map(path => ({ path, sha256: createHash('sha256').update(read(path)).digest('hex') })),
    boundary: 'Actual production Builders/methods, installed SDK lowering/property delivery and shared native control attributes/callbacks. Recorder branch removal and actual focus/glyph/layout remain native evidence. Domain ports record typed intents only.' };
  if (output) writeFileSync(new URL(output, root), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
