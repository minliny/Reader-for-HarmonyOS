import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installedEtsCompiler } from './lib/ets-compiler-runtime.mjs';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { readerEditingSdk } from './lib/reader-editing-sdk-probe.mjs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected = selectContractCases({
  'field-events': 'Actual public form methods with SDK-emitted native adapter: current change/submit/edit, retired callbacks, dynamic caret line height and unchanged draft owner.',
  'stable-body': 'Installed SDK AST: TTS/replace/download each retain one unconditional editing body and one Scroll site across chrome capacity branches. Structural evidence, no native mount/composition claim.',
  'zero-editor': 'Actual directory query admission method keeps the current editor enabled at zero height, while rejecting a retired/transitioning owner.',
  'tts-editor-admission': 'Actual TTS motion lifecycle preserves an accepted current editor through ordinary minimum admission loss; real owner retirement/transition still dismisses.',
  'tts-modal-capacity': 'Actual TTS modal height/padding/panel methods use shared observed keyboard intersection when native content cover stays full-size; already resized/zero hosts are not charged twice.',
  'search-result-lane': 'Actual SDK-emitted Search result body clips normalized native List overflow at the visual lane already reserved before paging; no pixel/hit claim.',
  'directory-publication': 'Actual value publication retains thousands of entries across motion and detects in-place data changes; installed SDK AST verifies all normal collection handoffs use publication plus scalar revision instead of deep-copying array Props.',
});
if (selected.length) {
  const { ts, options } = installedEtsCompiler();
  const read = name => readFileSync(new URL('../entry/src/main/ets/' + name, import.meta.url), 'utf8');
  function component(name) {
    const source = read(name);
    const tree = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
    assert.deepEqual(tree.parseDiagnostics, []);
    const declaration = tree.statements.find(node => node.members?.some(member => member.name?.getText(tree) === 'build'));
    assert(declaration);
    return { source, tree, declaration, member(name) {
      const member = declaration.members.find(member => member.name?.getText(tree) === name);
      assert(member, name); return member;
    } };
  }
  function methods(part, names, deps = {}) {
    const text = names.map(name => part.member(name).getText(part.tree)).join('\n');
    return pureModuleProbe('class Subject {\n' + text + '\n}', 'ReaderEditingHostMethods.ets', deps, ['Subject']).Subject;
  }
  for (const id of selected) {
    if (id === 'directory-publication') {
      const { ReaderDirectoryDataPublication } = pureModuleProbe(read('features/reading/presentation/ReaderDirectoryDataSnapshot.ts'),
        'ReaderDirectoryDataSnapshot.ts', {}, ['ReaderDirectoryDataPublication']);
      const publication = new ReaderDirectoryDataPublication();
      const entries = Array.from({length: 4096}, (_,index) => ({index, title: '章节'+index, downloadState:'missing',
        bookmarks: index===32 ? [{time:1,chapterIndex:32,chapterOffset:7,chapterTitle:'章节32',content:'原文',bookText:'摘录'}] : []}));
      const revision = publication.publish(entries), snapshot = publication.entriesAt(revision);
      assert.notStrictEqual(snapshot, entries, 'publication owns an independent business-value snapshot');
      for (let frame=0;frame<120;frame++) {
        assert.equal(publication.publish(entries.slice()), revision);
        assert.strictEqual(publication.entriesAt(revision), snapshot, 'motion does not republish or copy the collection');
      }
      entries[32].bookmarks[0].bookText='更新后的摘录';
      const next=publication.publish(entries);
      assert.equal(next, revision+1, 'same-reference business changes still invalidate the numeric revision');
      assert.equal(snapshot[32].bookmarks[0].bookText,'摘录','old values cannot be mutated through the original array');
      assert.equal(publication.entriesAt(next)[32].bookmarks[0].bookText,'更新后的摘录');
      const props=[['ReaderControlPanel.ets','tocEntries'],['ReaderControlDirectoryContent.ets','entries'],
        ['ReaderDirectoryNavigationSurface.ets','chapterEntries'],['ReaderDirectoryNavigationList.ets','chapterEntries']];
      for(const [file,array] of props) {
        const part=component('features/reading/ui/'+file);
        assert(!ts.getAllDecorators(part.member(array)).some(d=>d.getText(part.tree)==='@Prop'),file+' cannot clone the collection as an ArkUI Prop');
        assert(ts.getAllDecorators(part.member('directoryEntriesRevision')).some(d=>d.getText(part.tree)==='@Prop'));
        assert(!ts.getAllDecorators(part.member('directoryPublication')).length,'publication is a stable ordinary object reference');
      }
      for(const [file,child,forbidden] of [['LocalReadingExperience.ets','ReaderControlPanel','tocEntries'],
        ['ReaderControlPanel.ets','ReaderControlDirectoryContent','entries'],
        ['ReaderControlDirectoryContent.ets','ReaderDirectoryNavigationSurface','chapterEntries'],
        ['ReaderDirectoryNavigationSurface.ets','ReaderDirectoryNavigationList','chapterEntries'],
        ['BookDirectoryPage.ets','ReaderDirectoryNavigationSurface','chapterEntries'],
        ['FullDirectoryPanel.ets','ReaderDirectoryNavigationSurface','chapterEntries']]) {
        const part=component('features/reading/ui/'+file),calls=[];
        const visit=node=>{if(ts.isCallExpression(node)&&node.expression.getText(part.tree)===child)calls.push(node);ts.forEachChild(node,visit);};visit(part.tree);
        assert.equal(calls.length,1,file+' actual assembly');
        const names=calls[0].arguments[0].properties.map(p=>p.name?.getText(part.tree));
        assert(!names.includes(forbidden),file+' does not send the large collection through the old parameter');
        assert(names.includes('directoryPublication')&&names.includes('directoryEntriesRevision'));
      }
    }
    if (id === 'search-result-lane') {
      const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
      const source = read('features/reading/ui/ReaderControlSearchContent.ets');
      const { owner } = createReaderBuilderProbe(source, ['resultsBody'], {
        READER_SEARCH_LIST_ITEM_HEIGHT: 72, READER_SEARCH_LIST_CACHE_COUNT: 2,
      });
      const visualHeight = 80, nativeHeight = 80 * 72 / 54;
      Object.assign(owner, { displayState: () => ({ kind: 'results' }), resultDataSource: [],
        frame: () => ({ firstResult: { width: 240, x: 5 }, results: { width: 250, height: 128, x: 2, y: 40 } }),
        resultListFrame: () => ({ viewportHeightVp: nativeHeight, contentEndOffsetVp: 0 }),
        resultLayout: () => ({ viewportHeightVp: visualHeight }), currentInputEnabled: () => true,
        motionProgress: 0, loadMoreAction() {}, resultRow() {},
      });
      owner.resultsBody();
      const list = [...owner.nodes.values()].find(node => node.type === 'List');
      const lane = [...owner.nodes.values()].find(node => node.type === 'Stack' && node.width === 240);
      assert.equal(list.height, nativeHeight, 'normalized native coordinates remain unchanged');
      assert.equal(list.clip, false, 'authored overflowing rows retain their motion');
      assert.equal(lane.height, visualHeight, 'visual parent uses the paid list capacity, excluding paging');
      assert.equal(lane.clip, true, 'overflow cannot draw into the paging lane');
      assert.deepEqual(list.position, { x: 0, y: 0 });
      assert.deepEqual(lane.position, { x: 5, y: 0 });
    }
    if (id === 'tts-modal-capacity') {
      const part = component('features/reading/ui/ReaderTtsConfigOverlay.ets');
      // Compile the actual geometry without rebuilding a second algorithm in
      // the test. The window and native cover sizes are explicit finite facts.
      const metricSource = read('ui/foundation/ReaderWindowMetrics.ts');
      const m = pureModuleProbe(metricSource, 'ReaderWindowMetrics.ts', {},
        ['ReaderRectVp', 'ReaderInsetsVp', 'ReaderKeyboardAreaVp', 'ReaderWindowMetricsSnapshot', 'readerInteractiveSafeTop', 'readerInteractiveSafeBottom']);
      const g = pureModuleProbe(read('ui/layout/ReaderKeyboardGeometry.ts'), 'ReaderKeyboardGeometry.ts', m, ['readerKeyboardViewport']);
      const metrics = new m.ReaderWindowMetricsSnapshot(); metrics.ready = true;
      metrics.windowRect = new m.ReaderRectVp(0, 0, 365.714, 809.142);
      metrics.systemInsets = new m.ReaderInsetsVp(0, 40, 0, 0);
      metrics.keyboardArea = new m.ReaderKeyboardAreaVp(true, true, [new m.ReaderRectVp(0, 495.142, 365.714, 314)]);
      const Overlay = methods(part, ['modalEditingViewport', 'modalVisibleTop', 'modalVisibleHeight', 'managerOuterPadding', 'panelHeight'],
        { ...g, ReaderRectVp: m.ReaderRectVp, ReaderWindowCoordinator: { metrics: () => metrics } });
      const owner = Object.assign(new Overlay(), { metricsRevision: 2, modalOriginY: 0, modalUsableWidth: 365.714,
        modalUsableHeight: 809.142, manager: true, headerHeight: () => 58, footerHeight: () => 76, formatActionHeight: () => 44 });
      assert.equal(owner.modalVisibleTop(), 40, 'fixed header remains below nonIME safe top');
      assert.equal(owner.modalVisibleHeight(), 455.142);
      assert.equal(owner.panelHeight(), 455.142 - 32, 'full-size cover has a real bounded editor viewport');
      owner.modalUsableHeight = 495.142; assert.equal(owner.modalVisibleHeight(), 455.142, 'native resize is not charged twice');
      owner.modalOriginY = 40; owner.modalUsableHeight = 455.142;
      assert.equal(owner.modalVisibleTop(), 0); assert.equal(owner.modalVisibleHeight(), 455.142, 'already inset host does not pay safe top twice');
      owner.modalUsableHeight = 0; assert.equal(owner.panelHeight(), 0);
    }
    if (id === 'tts-editor-admission') {
      const part = component('features/reading/ui/ReaderControlTtsContent.ets');
      const Content = methods(part, ['onMotionChanged']);
      let current = true, p = 1, dismissals = 0;
      const actor = Object.assign(new Content(), { minimumLastProgress: 1, sourceOnly: 'none', configMounted: true,
        configField: 'manage', p: () => p, syncMorphScroll() {}, sharedInput: () => false, fullInput: () => false,
        editorInputCurrent: () => current, dismissConfiguration() { dismissals++; } });
      actor.onMotionChanged(); assert.equal(dismissals, 0, 'current editor survives ordinary minimum admission loss');
      current = false; actor.onMotionChanged(); assert.equal(dismissals, 1, 'retired owner still dismisses');
      current = true; p = .5; actor.onMotionChanged(); assert.equal(dismissals, 2, 'real semantic transition still dismisses');
      p = 1; actor.configMounted = false; actor.onMotionChanged(); assert.equal(dismissals, 3, 'unmounted editor still dismisses');
      actor.configMounted = true; actor.editorInputCurrent = undefined; actor.onMotionChanged(); assert.equal(dismissals, 4, 'legacy callers retain ordinary admission');
    }
    if (id === 'field-events') {
      const sdk = readerEditingSdk(), part = component('ui/controls/ReaderFormField.ets');
      const Field = methods(part, ['nativeInputId', 'textChangeHandler', 'submitHandler', 'change', 'submit', 'editChanged']);
      const field = new Field(), target = new sdk.ReaderEditableTarget(), calls = [];
      let lineHeight = 20;
      const controller = { getCaretOffset: () => ({ index: 3, x: 0, y: 0 }), scrollToVisible() {} };
      const context = { px2vp: value => value,
        getFrameNodeById: () => ({ getPositionToWindowWithTransform: () => ({ x: 0, y: 0 }) }),
        getComponentUtils: () => ({ getRectangleById: () => ({ size: { width: 200, height: 320 }, scale: { x: 1, y: 1 }, rotate: { angle: 0 } }) }),
      };
      Object.assign(field, { mounted: true, isEditable: true, inputIdentity: 'draft-a', specId: 'source-code', editingTarget: target,
        onTextChange: value => calls.push(['change', value]), onSubmit: () => calls.push(['submit']),
        onEditingChange: value => calls.push(['edit', value]),
      });
      target.mount(context, undefined, controller, () => true, () => lineHeight, field.nativeInputId());
      const oldChange = field.textChangeHandler(), oldSubmit = field.submitHandler();
      field.editChanged(true); oldChange('composition-preview'); oldSubmit();
      assert.deepEqual(calls, [['edit', true], ['change', 'composition-preview'], ['submit']]);
      assert.equal(target.measure().caret.height, 20);
      lineHeight = 40; assert.equal(target.measure().caret.height, 40, 'font change reads the current line height without rebinding the input');
      field.inputIdentity = 'draft-b';
      target.mount(context, undefined, controller, () => true, () => lineHeight, field.nativeInputId());
      oldChange('late'); oldSubmit(); assert.equal(calls.length, 3, 'retired callbacks cannot write or submit the successor');
      field.textChangeHandler()('current'); assert.deepEqual(calls.at(-1), ['change', 'current']);
      field.isEditable = false; field.textChangeHandler()('disabled'); field.submitHandler()(); assert.equal(calls.length, 4);
      field.mounted = false; field.isEditable = true; field.textChangeHandler()('unmounted'); assert.equal(calls.length, 4);
    }
    if (id === 'stable-body') {
      const specs = [
        ['features/reading/ui/ReaderTtsConfigOverlay.ets', 'boundedContent', 'configurationBody'],
        ['features/reading/ui/ReaderControlReplaceContent.ets', 'temporaryBody', 'temporaryBodyContent'],
        ['features/downloads/ui/SharedDownloadPage.ets', 'sheetContent', 'sheetBody'],
      ];
      function check(part, builder, body) {
        const roots = [], bodies = [];
        function visit(node, conditions = []) {
          const next = ts.isIfStatement(node) || ts.isConditionalExpression(node) ? [...conditions, node] : conditions;
          if ((ts.isCallExpression(node) || ts.isEtsComponentExpression(node)) && node.expression) {
            const name = node.expression.getText(part.tree);
            if (name === 'Scroll') roots.push({ node, conditions: next });
            if (name === 'this.' + body) bodies.push({ node, conditions: next });
          }
          ts.forEachChild(node, child => visit(child, next));
        }
        visit(part.member(builder).body);
        assert.equal(roots.length, 1, builder + ' has one persistent Scroll source site');
        assert.equal(roots[0].conditions.length, 0, 'Scroll cannot move into a capacity branch');
        assert.equal(bodies.length, 1, body + ' has one persistent source site');
        assert.equal(bodies[0].conditions.length, 0, 'editor body cannot move into a capacity branch');
      }
      for (const [file, builder, body] of specs) check(component(file), builder, body);
      // The prior threshold architecture is rejected independently of method
      // names: a branch around the Scroll changes declarative instance scope.
      const negative = component(specs[0][0]);
      const original = negative.member('boundedContent').body;
      negative.member = () => ({ body: ts.factory.createIfStatement(ts.factory.createTrue(), original) });
      assert.throws(() => check(negative, 'boundedContent', 'configurationBody'), /capacity branch/);
    }
    if (id === 'zero-editor') {
      const part = component('features/reading/ui/ReaderControlDirectoryContent.ets');
      const Content = methods(part, ['queryInteractive']);
      const owner = new Content(); let current = true;
      Object.assign(owner, { availableHeight: 0, progress: 1, currentEditorInputEnabled: () => current });
      assert.equal(owner.queryInteractive(), true);
      current = false; assert.equal(owner.queryInteractive(), false);
      current = true; owner.progress = .5; assert.equal(owner.queryInteractive(), false);
    }
    recordContractCasePass(id);
  }
  console.log('Boundary: actual source methods/SDK AST and finite native ports; no VM or native composition result.');
}
