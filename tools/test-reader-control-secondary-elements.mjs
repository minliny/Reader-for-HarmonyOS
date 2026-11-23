import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { selectedProductionClasses } from './lib/selected-production-methods.mjs';
import { readerFoundationTokens } from './lib/reader-tokens-probe.mjs';
import { readerTypographyRoles } from './lib/reader-typography-probe.mjs';
import { readerAppColor } from '../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts';

const definitions = {
  'production-imports': { description: 'Actual new secondary UI external identifiers have explicit production imports and resolvable exports, without injected probe namespaces.', resources: [] },
  'search-back-admission': { description: 'Actual retained Search QuickBack Button rejects pre-flush retired input, Full and unmounted callbacks.', resources: [] },
  'font-cell-semantics': { description: 'Actual retained Appearance font-cell Stack exposes custom button role, selected state and current focusability without replacing drag/click ownership.', resources: [] },
  'auto-timer-admission': { description: 'Actual retained timer-wheel native Button rechecks the current AutoPage Full owner and current timer bounds before dispatch.', resources: [] },
  'replace-row-admission': { description: 'Actual retained replacement rule native toggle rejects a row outside the current Quick first-three projection and retired input.', resources: [] },
  'replace-quick-scroll': { description: 'Actual measured Replace first-three-row Quick flow remains reachable in short/narrow large-font viewports, with exclusive scroll owners and stable morph.', resources: [] },
};
const selected = selectContractCases(definitions);
if (selected.length) {
  registerHooks({ resolve(specifier, context, next) {
    try { return next(specifier, context); } catch (error) {
      if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) return next(specifier + '.ts', context);
      throw error;
    }
  } });
  const actor = await import('../entry/src/main/ets/features/reading/ui/ReaderControlActorGeometry.ts');
  const geometry = await import('../entry/src/main/ets/features/reading/ui/ReaderControlReplaceGeometry.ts');
  const layoutGeometry = await import('../entry/src/main/ets/features/reading/ui/ReaderLayoutGeometry.ts');
  const searchGeometry = await import('../entry/src/main/ets/features/reading/ui/ReaderControlSearchGeometry.ts');
  const morph = await import('../entry/src/main/ets/features/reading/ui/ReaderControlMorphScroll.ts');
  const read = name => readFileSync(new URL('../entry/src/main/ets/features/reading/ui/' + name, import.meta.url), 'utf8');
  const deps = { ScrollSource: { SCROLLER: 'scroller' }, ...readerTypographyRoles, ...readerFoundationTokens, ...actor, ...geometry, ...morph, ...searchGeometry, readerAppColor };
  const nodes = (owner, type) => [...owner.nodes.values()].filter(node => node.type === type);
  for (const id of selected) {
    if (id === 'production-imports') {
      const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
      const { resolve, dirname } = await import('node:path');
      const { fileURLToPath } = await import('node:url');
      const compiler = installedEtsCompiler(), { ts, options } = compiler;
      const imports = [
        ['ReaderControlReplaceContent.ets', 'readerControlUnit', './ReaderControlActorGeometry', 'ts'],
        ['ReaderControlAppearanceContent.ets', 'ReaderActionAccessibility', '../../../ui/controls/ReaderActionAccessibility', 'ets'],
      ];
      const verify = (name, symbol, expectedSpecifier, extension, sourceOverride) => {
        const file = new URL('../entry/src/main/ets/features/reading/ui/' + name, import.meta.url);
        const tree = ts.createSourceFile(fileURLToPath(file), sourceOverride ?? read(name), ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
        assert.equal(tree.parseDiagnostics.length, 0);
        const matches = tree.statements.filter(ts.isImportDeclaration).filter(node => node.moduleSpecifier.text === expectedSpecifier)
          .flatMap(node => node.importClause?.namedBindings?.elements ?? []).filter(binding => binding.name.text === symbol);
        assert.equal(matches.length, 1, name + ' explicitly imports ' + symbol + ' from its actual module');
        const exportedName = matches[0].propertyName?.text ?? symbol;
        const target = resolve(dirname(fileURLToPath(file)), expectedSpecifier + '.' + extension);
        const exported = ts.createSourceFile(target, readFileSync(target, 'utf8'), ts.ScriptTarget.Latest, true,
          extension === 'ets' ? ts.ScriptKind.ETS : ts.ScriptKind.TS, options);
        assert.equal(exported.parseDiagnostics.length, 0);
        assert.ok(exported.statements.some(node => node.name?.text === exportedName && node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)),
          'the production import resolves to actual exported ' + exportedName);
      };
      for (const entry of imports) verify(...entry);
      const missing = read('ReaderControlReplaceContent.ets').replace("import { readerControlUnit } from './ReaderControlActorGeometry';\n", '');
      assert.notEqual(missing, read('ReaderControlReplaceContent.ets'));
      assert.throws(() => verify(...imports[0], missing), /explicitly imports readerControlUnit/,
        'the exact production missing-import failure is rejected without a probe-injected actor namespace');
      console.log(JSON.stringify({ kind: 'secondary-production-import-admission', importedSymbols: imports.length, explicitExportResolution: 'PASS', arktsBuild: 'NOT_RUN' }));
    }
    if (id === 'search-back-admission') {
      const properties = createArkUIPropertyRuntimeProbe();
      const source = read('ReaderControlQuickBack.ets');
      const back = createReaderBuilderProbe(source, ['build', 'icon', 'labelStyle', 'variant', 'scheme', 'actionWidth', 'actionHeight', 'actionVisible', 'actionEnabled', 'onAction'], { ...deps, ...properties.sdk }, properties.hooks);
      const parentSource = read('ReaderControlSearchContent.ets');
      const mount = sourceText => {
        const probe = createReaderBuilderProbe(sourceText, ['quickBack', 'currentInputEnabled'], {
          ...deps, ReaderControlQuickBack: back.Component,
        }, { mountChildren: true, childSources: { ReaderControlQuickBack: source } });
        const owner = probe.owner; let current = true, called = 0;
        Object.assign(owner, { queryInputMounted: true, interactionEnabled: true, motionProgress: 0, appThemeScheme: 'day',
          frame: () => ({ back: { x: 10, y: 13, width: 70, height: 44, opacity: 1 } }),
          presentation: () => ({ contentOpacity: 1, contentBlur: 0 }), inputCurrent: () => current, onBack: () => called++ });
        owner.quickBack();
        const child = [...owner.children.values()].find(value => value instanceof back.Component);
        assert.ok(child, 'actual shared QuickBack component mounts');
        const button = nodes(child, 'Button')[0];
        assert.ok(button && button.width === 70 && button.height === 44);
        button.onClick(); assert.equal(called, 1);
        current = false; button.onClick();
        assert.equal(called, 1, 'retired input is rejected before any parent/child replay');
        current = true; owner.motionProgress = 1; button.onClick();
        assert.equal(called, 1, 'old Quick native callback cannot return from Full');
        owner.motionProgress = 0; owner.queryInputMounted = false; button.onClick();
        assert.equal(called, 1, 'unmounted Search cannot navigate');
        owner.queryInputMounted = true; button.onClick(); assert.equal(called, 2);
        assert.equal(nodes(child, 'Button')[0], button, 'the original native Button remains mounted');
      };
      mount(parentSource);
      const old = parentSource.replace("if (this.queryInputMounted && this.currentInputEnabled() && this.motionProgress === 0) this.onBack();", 'this.onBack();');
      assert.notEqual(old, parentSource);
      assert.throws(() => mount(old), /retired input/, 'the former unguarded callback is a failing negative');
    }
    if (id === 'font-cell-semantics') {
      const state = await import('../entry/src/main/ets/features/reading/application/ReaderAppearanceState.ts');
      const renderStyle = await import('../entry/src/main/ets/features/reading/ui/ReaderAppearanceRenderStyle.ts');
      const source = read('ReaderControlAppearanceContent.ets');
      const gesture = new Proxy({}, { get: () => () => {} });
      const owner = createReaderBuilderProbe(source, ['fontCell'], { ...deps, ...state, ...renderStyle,
        LongPressGesture: gesture, globalThis: { Gesture: gesture, LongPressGesture: gesture }, GesturePriority: { Low: 'low' } }).owner;
      let enabled = true, selectedFont = 'system', ready = true, calls = 0;
      Object.assign(owner, { appThemeScheme: 'day', snapshot: state.createDefaultReaderAppearanceSnapshot(), draggedFontId: '', suppressFontClick: false,
        fontActor: () => ({ width: 62, height: 44, opacity: 1 }), activeFont: font => font === selectedFont,
        fontInput: () => enabled, fontPreviewReady: () => ready, visiblePreviewFamily: () => 'HarmonyOS Sans',
        presentation: () => ({ contentOpacity: 1, contentBlur: 0 }), sharedClip: () => undefined, fontCellPosition: () => ({ x: 0, y: 0 }),
        importLayout: 'separate-cell', fontTouch() {}, beginFontDrag() {}, settleFontDrag() {}, requestVisibleFontPreview() {},
        onFontChange: () => calls++, onCustomFontImport: () => calls++ });
      owner.fontCell('system');
      const cell = nodes(owner, 'Stack')[0]; assert.ok(cell);
      assert.equal(cell.accessibilityRole, 'AccessibilityRoleType.BUTTON'); assert.equal(cell.focusable, true); assert.equal(cell.accessibilitySelected, true);
      const click = cell.onClick; click(); assert.equal(calls, 1);
      selectedFont = 'serif'; ready = false; owner.replay();
      assert.equal(nodes(owner, 'Stack')[0], cell); assert.equal(cell.accessibilitySelected, false);
      assert.match(cell.accessibilityText, /预览准备中/);
      enabled = false; click(); assert.equal(calls, 1, 'old native callback still checks the current font owner before replay');
      owner.replay(); assert.equal(cell.focusable, false); assert.equal(cell.enabled, false);
      assert.equal(cell.accessibilityLevel, 'no-hide-descendants');
      enabled = true; owner.replay(); assert.equal(cell.focusable, true);
      assert.ok(cell.width >= 44 && cell.height >= 44);
    }
    if (id === 'auto-timer-admission') {
      const limits = await import('../entry/src/main/ets/features/reading/ui/ReaderAutoPageFullState.ts');
      const properties = createArkUIPropertyRuntimeProbe();
      const wheelSource = read('ReaderControlTimerWheel.ets');
      const wheel = createReaderBuilderProbe(wheelSource, ['build', 'targetWidth', 'targetHeight', 'offsets', 'valid', 'label', 'step',
        'appThemeScheme', 'value', 'minimum', 'maximum', 'wheelWidth', 'rowHeight', 'unitHeight', 'neighbours', 'unit', 'interactionEnabled', 'onStep'],
        { ...deps, ...properties.sdk }, properties.hooks);
      const currentSource = read('ReaderControlAutoPageContent.ets');
      const verify = sourceText => {
        const parent = createReaderBuilderProbe(sourceText, ['timerWheel', 'commitTimerStep', 'currentTimerValue', 'adjacentTimerValue',
          'hasAdjacentTimerValue', 'fullInput', 'p', 'currentInputEnabled'], { ...deps, ...limits, ReaderControlTimerWheel: wheel.Component },
          { mountChildren: true, childSources: { ReaderControlTimerWheel: wheelSource } }).owner;
        const changes = []; let input = true;
        Object.assign(parent, { motionProgress: 1, interactionEnabled: true, inputCurrent: () => input, timerMinutes: 10, timerSeconds: 10,
          timerWheelWidth: () => 76, textMetric: (_name, fallback) => fallback, onTimerChange: (...values) => changes.push(values) });
        parent.timerWheel(false);
        const child = [...parent.children.values()].find(value => value instanceof wheel.Component);
        assert.ok(child);
        const buttons = nodes(child, 'Button'); assert.equal(buttons.length, 3);
        const increase = buttons.find(value => value.position.y === 88), decrease = buttons.find(value => value.position.y === 0);
        increase.onClick(); assert.deepEqual(changes, [[10, 11]]);
        input = false; increase.onClick(); assert.equal(changes.length, 1, 'retired owner rejects the old native wheel callback before replay');
        input = true; parent.motionProgress = 0; increase.onClick(); assert.equal(changes.length, 1, 'Quick does not own the Full timer');
        parent.motionProgress = .5; increase.onClick(); assert.equal(changes.length, 1, 'morph has no timer input');
        parent.motionProgress = 1; parent.timerSeconds = 59; increase.onClick(); assert.equal(changes.length, 1, 'the current maximum overrides the old child value');
        parent.timerSeconds = 0; decrease.onClick(); assert.equal(changes.length, 1, 'the current minimum overrides the old child value');
        parent.timerSeconds = 20; increase.onClick(); assert.deepEqual(changes.at(-1), [10, 21]);
        assert.equal(nodes(child, 'Button').find(value => value.position.y === 88), increase);
      };
      verify(currentSource);
      const previous = currentSource.replace('    if (!this.fullInput() || !this.hasAdjacentTimerValue(minutes, delta)) return;\n', '');
      assert.notEqual(previous, currentSource);
      assert.throws(() => verify(previous), /retired owner/, 'the former parent callback fails before the child props flush');
    }
    if (id === 'replace-row-admission') {
      const source = read('ReaderControlReplaceContent.ets');
      const switchSource = read('ReaderControlSwitchTrack.ets');
      class SwitchSlot { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id, children: new Map(), nodes: new Map() }); } }
      const verify = sourceText => {
        const owner = createReaderBuilderProbe(sourceText, ['ruleRow', 'fullInput', 'quickInput', 'readyInput', 'currentInputEnabled'],
          { ...deps, ReaderControlSwitchTrack: SwitchSlot }, { childSources: { ReaderControlSwitchTrack: switchSource } }).owner;
        const rule = { id: 4, name: '第四条', isEnabled: true, pattern: '甲', replacement: '乙' };
        let index = 3, changes = 0, input = true;
        Object.assign(owner, { motionProgress: 1, interactionEnabled: true, inputCurrent: () => input,
          state: { status: 'ready', sessionKey: 'one' }, layer: '', localPending: false, appThemeScheme: 'day',
          frame: () => geometry.sampleReaderControlReplace(owner.motionProgress, 286, 666), presentation: () => ({ contentOpacity: 1, contentBlur: 0 }),
          rowClip: () => undefined, ruleIcon() {}, scopeSummary: () => '正文', onToggle: () => { changes++; return Promise.resolve(); }, perform: action => action() });
        owner.ruleRow(() => rule, () => index);
        const toggle = nodes(owner, 'Button')[0]; assert.ok(toggle);
        toggle.onClick(); assert.equal(changes, 1);
        owner.motionProgress = 0; toggle.onClick(); assert.equal(changes, 1, 'the fourth Full row is outside the current Quick projection before replay');
        index = 2; toggle.onClick(); assert.equal(changes, 2, 'the original first-three Quick rows retain their action');
        input = false; toggle.onClick(); assert.equal(changes, 2);
        input = true; owner.state.writeUncertain = true; toggle.onClick(); assert.equal(changes, 2);
        owner.state.writeUncertain = false; owner.state.mutationPending = true; toggle.onClick(); assert.equal(changes, 2);
      };
      verify(source);
      const former = source.replaceAll(' && (this.fullInput() || index() < 3)', '');
      assert.notEqual(former, source);
      assert.throws(() => verify(former), /fourth Full row/, 'the former hidden row callback dispatches from Quick');
    }
    if (id === 'replace-quick-scroll') {
      const classes = selectedProductionClasses(new URL('../entry/src/main/ets/ui/foundation/ReaderTypography.ets', import.meta.url), ['ReaderTextStyle']);
      const measure = pureModuleProbe(read('ReaderControlTextMeasurement.ets'), 'ReaderControlTextMeasurement.ets', { WordBreak: { BREAK_WORD: 'break' } }, ['measureReaderControlText']);
      const minimum = pureModuleProbe(read('ReaderControlReplaceMinimum.ets'), 'ReaderControlReplaceMinimum.ets', { ...deps, ...classes, ...measure }, ['measureReaderControlReplaceMinimum']);
      const source = read('ReaderControlReplaceContent.ets');
      let scale = 1;
      const context = { px2vp: value => value, getMeasureUtils: () => ({
        measureText: options => [...options.textContent].length * Number(options.fontSize) * scale,
        measureTextSize: options => ({ width: Math.min(options.constraintWidth, [...options.textContent].length * Number(options.fontSize) * scale),
          height: Number.parseFloat(options.lineHeight ?? options.fontSize) * scale * (options.maxLines === 1 ? 1 : Math.ceil([...options.textContent].length * Number(options.fontSize) * scale / options.constraintWidth)) }),
      }) };
      const methods = ['quickFlowExtra', 'quickFlowContentHeight', 'quickFlowInput', 'syncQuickScroll', 'onQuickDidScroll',
        'quickScrollDelta', 'quickScrollTranslation', 'onSourceChanged', 'frame', 'fullInput', 'quickInput', 'currentInputEnabled'];
      let samples = 0, oldClippedSamples = 0;
      for (scale of [1, 1.3, 1.6, 2]) for (const width of [220, 262, 286]) for (const height of [100, 190, 240]) {
        const widths = { panelWidthVp: width + 78, quickContentWidthVp: width, fullContentWidthVp: width + 52 };
        const profile = minimum.measureReaderControlReplaceMinimum(context, widths, '', '核对原规则操作', '规则名称', '匹配 → 替换', '正文', '编辑替换规则', false);
        const owner = createReaderBuilderProbe(source, methods,
          { ...deps, readerControlExtentFits: layoutGeometry.readerControlExtentFits }).owner;
        let offset = 0, input = true;
        Object.assign(owner, { minimumKey: 'current|1', minimumProfiles: new Map([['current|1', profile]]), state: { rules: Array.from({ length: 7 }, (_, id) => ({ id })), errorMessage: '' },
          localError: '', layer: '', motionProgress: 0, availableWidth: width, availableHeight: height, quickContentHeight: height,
          interactionEnabled: true, inputCurrent: () => input, quickScrollMotion: morph.createReaderControlMorphScroll(),
          quickScroller: { currentOffset: () => ({ yOffset: offset }), scrollTo: value => { offset = value.yOffset; } },
          cachedProgress: -1, cachedWidth: -1, cachedHeight: -1, cachedMinimumKey: '', cachedQuickContentHeight: -1 });
        owner.state.rules = owner.state.rules.slice(0, 1);
        const single = owner.frame();
        const singleHeight = owner.quickFlowContentHeight();
        owner.state.rules = Array.from({ length: 7 }, (_, id) => ({ id }));
        const quick = owner.frame();
        if (owner.quickFlowContentHeight() > singleHeight + .1) {
          assert.notEqual(quick, single, 'same-key one-to-three data change invalidates the real cached frame');
          assert.ok(quick.list.height > single.list.height);
        }
        const beforeErrorExtra = owner.quickFlowExtra();
        owner.localError = '本地回执错误';
        const withError = owner.frame();
        if (owner.quickFlowExtra() !== beforeErrorExtra) assert.notEqual(withError, quick, 'same-key local error growth invalidates the real cached frame');
        assert.ok(withError.quickFooter.y + withError.quickFooter.height <= owner.quickFlowContentHeight() + .1);
        owner.localError = '';
        assert.equal(owner.frame().list.height, quick.list.height, 'same-key clearing error restores its exact current list budget');
        const former = geometry.sampleReaderControlReplace(0, width, height, profile, height);
        if (former.list.height + .1 < profile.quick.rowHeight * 3) oldClippedSamples++;
        assert.ok(quick.list.height + .1 >= profile.quick.rowHeight * 3, 'the natural Quick list pays exactly the original first-three-row projection');
        assert.ok(quick.quickFooter.y + quick.quickFooter.height <= owner.quickFlowContentHeight() + .1);
        const quickOverflow = !layoutGeometry.readerControlExtentFits(
          owner.quickContentHeight + owner.quickFlowExtra(), owner.quickContentHeight);
        assert.equal(owner.quickFlowInput(), quickOverflow);
        assert.equal(owner.quickScrollDelta(20, 'drag').yOffset, quickOverflow ? 20 : 0);
        input = false; assert.equal(owner.quickScrollDelta(20, 'drag').yOffset, 0, 'current input retirement closes Quick scroll immediately'); input = true;
        offset = owner.quickFlowExtra(); owner.syncQuickScroll(); owner.onQuickDidScroll();
        const anchor = offset;
        owner.motionProgress = .5; owner.availableHeight = height + 200; owner.syncQuickScroll();
        assert.equal(offset - owner.quickScrollTranslation(), anchor * .5, 'same Quick native scroll projects continuously through the shared p');
        assert.equal(owner.quickScrollDelta(20, 'drag').yOffset, 0, 'morph has no native user scroll owner');
        owner.motionProgress = 1; owner.availableHeight = 666; owner.syncQuickScroll(); owner.onQuickDidScroll();
        assert.equal(offset, 0, 'settled Full retires Quick offset'); assert.equal(owner.quickFlowExtra() * (1 - owner.motionProgress), 0);
        assert.equal(owner.quickFlowInput(), false); assert.equal(owner.fullInput(), true);
        owner.motionProgress = 0; owner.availableHeight = height; owner.syncQuickScroll();
        assert.equal(owner.quickScrollMotion.fullScrollOffset, 0, 'return to Quick starts at the untouched original top');
        Object.assign(owner, { lastSessionKey: 'old-book', onMinimumContentChanged() {}, dismissTemporaryLayer() {}, onFullDidScroll() {},
          scroller: { currentOffset: () => ({ yOffset: 0 }), scrollTo() {} } });
        owner.state.sessionKey = 'next-book'; offset = 50;
        owner.onSourceChanged(); assert.equal(offset, 0, 'a bound previous-book Quick scroll resets at the same owner');
        owner.quickScroller = { currentOffset: () => undefined, scrollTo: () => assert.fail('unbound Quick Scroller must not receive a reset') };
        owner.state.sessionKey = 'new-book-before-native-mount'; owner.onSourceChanged();
        samples++;
      }
      assert.ok(oldClippedSamples > 0, 'the former fixed Quick list clips its original first three rows in this same measured matrix');
      // Actual build body with caller-authored child builders intentionally stubbed. The SDK still lowers both real Scroll parents and all input predicates.
      const mounted = createReaderBuilderProbe(source, ['build', ...methods, 'nativeScrollDelta'], deps).owner;
      let originalOffset = 0;
      Object.assign(mounted, { availableWidth: 262, availableHeight: 100, quickContentHeight: 100, fullContentHeight: 666,
        minimumKey: 'current', minimumProfiles: new Map(), motionProgress: 0, interactionEnabled: true, layer: '',
        state: { rules: [], errorMessage: '' }, localError: '', appThemeScheme: 'day', scrollMotion: morph.createReaderControlMorphScroll(), quickScrollMotion: morph.createReaderControlMorphScroll(),
        quickScroller: { currentOffset: () => ({ yOffset: originalOffset }), scrollTo: value => { originalOffset = value.yOffset; } },
        scroller: { currentOffset: () => ({ yOffset: 0 }) }, quickBack() {}, ruleToolbar() {}, quickFooter() {}, statusContent() {}, textAction() {},
        quickFlowExtra: () => 160, listContentMinHeight: () => 132, sharedScrollTranslation: () => 0, fullOnlyScrollTranslation: () => 0 });
      mounted.initialRender();
      const scrolls = nodes(mounted, 'Scroll'); assert.equal(scrolls.length, 2);
      assert.deepEqual(scrolls.map(node => node.enableScrollInteraction).sort(), [false, true]);
      mounted.motionProgress = 1; mounted.replay();
      assert.deepEqual(scrolls.map(node => node.enableScrollInteraction).sort(), [false, true]);
      mounted.motionProgress = .5; mounted.replay(); assert.ok(scrolls.every(node => node.enableScrollInteraction === false));
      console.log(JSON.stringify({ kind: 'reader-replace-quick-flow', measuredCompositions: samples, formerClippedCompositions: oldClippedSamples, firstRows: 3, nativeScrollParents: 2, simultaneousInputOwners: 1, nativeRaster: 'NOT_RUN' }));
    }
    recordContractCasePass(id);
  }
}
