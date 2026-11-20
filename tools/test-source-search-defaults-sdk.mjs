import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected = selectContractCases({
  defaults: 'Current SDK Source/RSS/Book/Directory defaults and edit/submit/retirement; Directory focus remains opt-in and variant-bound. Finite frame/controller ports, no Native focus/keyboard.',
});
if (selected.length) {
  const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
  const { createReaderComponentProbe } = await import('./lib/reader-component-probe.mjs');
  const { builderComponentMembers } = await import('./lib/ets-builder-probe.mjs');
  const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
  const { foundationSpecs, readerFoundationTokens } = await import('./lib/reader-foundation-control-probe.mjs');
  const { readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
  const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
  const { readerAppColor } = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
  const { ReaderWindowMetricsSnapshot, ReaderRectVp } = await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
  const { ts, options, root: sdk, require: sdkRequire } = installedEtsCompiler();
  const read = name => readFileSync(new URL('../entry/src/main/ets/features/common/' + name, import.meta.url), 'utf8');
  const source = read('ReaderSearchField.ets');
  const sizing = pureModuleProbe(read('ReaderSurfaceResolvers.ts'), 'ReaderSurfaceResolvers.ts', {}, ['readerReadableFontScale', 'readerScaledControlHeight']);
  const accessibility = pureModuleProbe(read('ReaderActionAccessibility.ets'), 'ReaderActionAccessibility.ets', { AccessibilityRoleType: { BUTTON: 'BUTTON' } }, ['ReaderActionAccessibility', 'readerActionTouchRegion']);
  const areaSource = read('ReaderPageShell.ts');
  const areaTree = ts.createSourceFile('ReaderPageShell.ts', areaSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS, options);
  assert.equal(areaTree.parseDiagnostics.length, 0);
  const areaFunction = areaTree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'readerPageAreaLength');
  assert.ok(areaFunction);
  const { readerPageAreaLength } = pureModuleProbe(areaFunction.getText(areaTree), 'ReaderPageShell.ts', {}, ['readerPageAreaLength']);
  function parse(definition) {
    const tree = ts.createSourceFile('ReaderSearchField.ets', definition, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
    assert.equal(tree.parseDiagnostics.length, 0, 'whole current field parses');
    return tree;
  }
  function fixture(variant, scale, overrides = {}, definition = source) {
    const tree = parse(definition), declarations = tree.statements.filter(ts.isClassDeclaration);
    const globals = pureModuleProbe(declarations.map(node => node.getText(tree)).join('\n'), 'ReaderSearchField.ets', { ...accessibility, FrameCallback: class {} }, declarations.map(node => node.name.text));
    const properties = createArkUIPropertyRuntimeProbe(), frames = [], focusRequests = [], events = [], caretScrolls = [];
    const metrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, 366, 844)); metrics.systemFontScale = scale;
    const context = { postFrameCallback: frame => frames.push(frame), getFocusController: () => ({ requestFocus: id => { focusRequests.push(id); return true; } }) };
    class Controller {
      stopEditing() {}
      getCaretOffset() { return { index: 7 }; }
      scrollToVisible(range) { caretScrolls.push(range); }
    }
    const ids = sdkRequire(sdk + '/lib/component_map.js').ID_ATTRS, saved = new Map(ids); ids.clear(); let owner;
    try {
      ({ owner } = createReaderComponentProbe(definition, builderComponentMembers(definition), {
        ...properties.sdk, ...readerFoundationTokens, ...readerTypographyRoles, ...foundationSpecs(), ...sizing, ...accessibility, ...globals,
        readerPageAreaLength, readerAppColor, ReaderWindowCoordinator: { metrics: () => metrics }, TextInputController: Controller,
      }, properties.hooks));
    } finally { ids.clear(); for (const [key, value] of saved) ids.set(key, value); }
    owner.getUIContext = () => context;
    Object.assign(owner, { variant, mode: variant === 'sourceManagement' ? 'live' : variant === 'rssPassive' ? 'passive' : 'submit',
      text: '', placeholder: 'Search', accessibilityLabel: 'Search', appThemeScheme: 'day',
      onTextChange: value => events.push(['edit', value]), onSubmit: () => events.push(['submit']),
      onFocusChanged: value => events.push(['book-focus', value]),
      onDirectoryFocusChanged: (...values) => events.push(['directory-focus', ...values]), ...overrides });
    owner.aboutToAppear(); owner.initialRender();
    return { owner, nodes: [...owner.nodes.values()], frames, focusRequests, events, caretScrolls };
  }
  function checkDefaults(definition) {
    for (const variant of ['sourceManagement', 'rssPassive', 'bookPage', 'bookPanel', 'readerDirectory']) for (const scale of [1, 2]) {
      const f = fixture(variant, scale, {}, definition), input = f.nodes.find(node => node.type === 'TextInput');
      assert.deepEqual(f.frames, [], 'default construction never schedules native focus'); assert.deepEqual(f.focusRequests, []);
      assert.equal(f.owner.directoryFocusAllowed, false); assert.equal(f.owner.directoryFocusId, ''); assert.equal(f.owner.directoryFocusRevision, 0); assert.equal(f.owner.directoryKeyboardOnFocus, true);
      if (variant === 'rssPassive') {
        assert.equal(input, undefined); assert.ok(f.nodes.some(node => node.type === 'Text' && node.create === 'Search'));
      } else {
        assert.ok(input); assert.equal(input.accessibilityText, 'Search'); assert.equal(input.maxLines, 1); assert.equal(input.padding, 0); assert.equal(input.borderRadius, 0);
        assert.equal(typeof input.onChange, 'function'); assert.equal(typeof input.onSubmit, 'function');
        assert.equal(typeof input.id === 'string' ? input.id : undefined, variant.startsWith('book') ? 'reader-book-search-input' : undefined);
        if (variant === 'sourceManagement') assert.equal(input.height, 42);
        if (variant === 'readerDirectory') {
          assert.equal(input.minFontScale, 1); assert.equal(input.maxFontScale, scale);
          for (const key of ['onFocus', 'onBlur', 'onAreaChange', 'enableKeyboardOnFocus']) assert.equal(input[key], undefined, 'Directory native focus channels are opt-in');
        }
        input.onChange('next'); input.onSubmit(); assert.deepEqual(f.events, [['edit', 'next'], ['submit']]);
      }
      f.owner.aboutToDisappear(); const count = f.events.length; input?.onChange('retired'); input?.onSubmit(); assert.equal(f.events.length, count, 'old native callbacks do not publish after retirement');
    }
  }
  function checkWrongVariant(definition) {
    for (const variant of ['sourceManagement', 'rssPassive', 'bookPage', 'bookPanel']) {
      const f = fixture(variant, 1, { directoryFocusAllowed: true, directoryFocusId: 'foreign-directory', directoryFocusRevision: 1 }, definition);
      // Invoke actual emitted callbacks, without naming private directory methods.
      const input = f.nodes.find(node => node.type === 'TextInput'); input?.onAreaChange?.({}, { width: 100, height: 44 }); input?.onFocus?.();
      assert.ok(!f.nodes.some(node => node.id === 'foreign-directory')); assert.ok(!f.events.some(event => event[0] === 'directory-focus')); assert.deepEqual(f.focusRequests, []);
      // Book focus can schedule its existing caret-follow frame, never Directory focus.
      for (const frame of f.frames.splice(0)) frame.onIdle(); assert.deepEqual(f.focusRequests, []); f.owner.aboutToDisappear();
    }
  }
  function checkBookRetirement(definition) {
    for (const variant of ['bookPage', 'bookPanel']) {
      const f = fixture(variant, 1, { focusOnAppear: true, submitEnabled: false }, definition), input = f.nodes.find(node => node.type === 'TextInput');
      assert.equal(f.frames.length, 1, 'explicit Book initial focus creates one finite frame'); input.onSubmit(); assert.deepEqual(f.events, [], 'disabled submit does not publish');
      const initialFocus = f.frames.shift(); initialFocus.onIdle(); assert.deepEqual(f.focusRequests, ['reader-book-search-input']);
      input.onFocus(); input.onTextSelectionChange(1, 2); assert.equal(f.frames.length, 1, 'caret follow is coalesced'); f.frames.shift().onIdle();
      assert.deepEqual(f.caretScrolls, [{ start: 7, end: 7 }], 'actual controller caret remains authoritative');
      input.onTextSelectionChange(2, 3); const retiredCaret = f.frames.shift(); input.onBlur(); retiredCaret.onIdle(); assert.equal(f.caretScrolls.length, 1, 'blur cancels old follow');
      f.owner.aboutToDisappear(); initialFocus.onIdle(); input.onFocus(); assert.equal(f.focusRequests.length, 1, 'old focus frame cannot affect retired opening'); assert.equal(f.caretScrolls.length, 1);
    }
  }
  checkDefaults(source); checkWrongVariant(source); checkBookRetirement(source);
  // Equivalence proof: public execution follows private Builder renames.
  const tree = parse(source), edits = [];
  const visit = node => {
    if (ts.isIdentifier(node) && ['fixedLineHeightField', 'autoLineHeightField'].includes(node.text)) edits.push({ start: node.getStart(tree), end: node.end, value: node.text + 'Equivalent' });
    ts.forEachChild(node, visit);
  };
  visit(tree); assert.ok(edits.length >= 4); let equivalent = source;
  for (const edit of edits.sort((a, b) => b.start - a.start)) equivalent = equivalent.slice(0, edit.start) + edit.value + equivalent.slice(edit.end);
  checkDefaults(equivalent); checkWrongVariant(equivalent); checkBookRetirement(equivalent);
  const modifier = tree.statements.find(node => ts.isClassDeclaration(node) && node.members.some(member => member.name?.getText(tree) === 'applyNormalAttribute'));
  const apply = modifier.members.find(member => member.name?.getText(tree) === 'applyNormalAttribute');
  const fence = apply.body.statements.find(node => ts.isIfStatement(node) && ts.isBlock(node.thenStatement)); assert.ok(fence);
  const fault = source.slice(0, fence.expression.getStart(tree)) + 'true' + source.slice(fence.expression.end);
  assert.throws(() => checkWrongVariant(fault), assert.AssertionError, 'wrong-variant native focus setter leak must fail');
  console.log(JSON.stringify({ status: 'PASS', currentDefaultContexts: 10, equivalentDefaultContexts: 10, wrongVariantContexts: 4, bookControllerContexts: 2, equivalentPrivateBuilders: 2,
    negative: 'wrong-variant native focus setter leak rejected', historicalComparison: 'INERT_ARCHIVED_NOT_RUN', boundary: 'Actual SDK Builder/attributes/property classes and finite focus/frame/controller ports. Native focus/keyboard/font/pixels NOT_RUN.' }));
  recordContractCasePass('defaults');
}
