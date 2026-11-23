import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected = selectContractCases({
  'home-scope': {
    description: 'The real RSS gateway never produces feed-owned original mutations; both home content paths retain ordinary read feedback after retiring the unreachable surface.',
    resources: [],
  },
  'editor-overlay': {
    description: 'The retained RSS editor supplies original-operation recovery only to the bounded overlay host and keeps ordinary retry actions in form content.',
    resources: [],
  },
  'stable-identity': {
    description: 'Mutable RSS recovery facts update the same action actors while the captured original identity rejects busy, superseded and retired callbacks.',
    resources: [],
  },
  'management-overlay': {
    description: 'RSS management native-list feedback keeps ordinary read/empty actions in content and mounts original-operation recovery only in the current bounded overlay.',
    resources: [],
  },
});

if (selected.length > 0) {
  registerHooks({ resolve(specifier, context, next) {
    try { return next(specifier, context); }
    catch (error) {
      if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier))
        return next(specifier + '.ts', context);
      throw error;
    }
  } });
  const { boundedSurfaceSdk, boundedMembers } = await import('./lib/bounded-surface-sdk-probe.mjs');
  const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
  const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
  const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
  const { projectOperationFacts } = await import('../entry/src/main/ets/app/ReaderOperationFacts.ts');
  const { readerRecoveryView } = await import('../entry/src/main/ets/app/ReaderRecoveryProjection.ts');
  const { rssOriginalMatchesScope } = await import('../entry/src/main/ets/features/rss/application/RssMutationRecoveryContract.ts');
  const read = path => readFileSync(new URL('../entry/src/main/ets/' + path, import.meta.url), 'utf8');
  const { ts, options } = installedEtsCompiler();
  const parse = (source, file) => {
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
    assert.deepEqual(tree.parseDiagnostics, []);
    return tree;
  };
  const component = tree => tree.statements.find(node => ts.isStructDeclaration(node));
  const member = (tree, name) => component(tree).members.find(node => node.name?.getText(tree) === name);
  const sourceExpression = expression => {
    const code = ts.transpileModule('function evaluate() { return ' + expression + '; }', {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText;
    return new Function('rssOriginalMatchesScope', code + '; return evaluate;')(rssOriginalMatchesScope);
  };
  const historical = () => JSON.parse(readFileSync(new URL('./fixtures/rss-recovery-flow-before-20261113.json', import.meta.url), 'utf8'));
  const original = (scope = 'editor', extra = {}) => ({
    generation: 7, operationId: 'original-operation', sequence: 3, method: 'rss-source.put', scope,
    subscriptionId: 'subscription', guid: '', confirmation: 'unknown', writeStage: 'core',
    busy: false, blocked: true, canRetryOriginal: true, message: '原操作结果尚未确认', ...extra,
  });
  const successfulRead = () => projectOperationFacts({ phase: 'succeeded', value: [], generation: 4 });

  function sdkWithRecovery(source = read('features/rss/ui/RssOriginalRecoverySurface.ets')) {
    const sdk = boundedSurfaceSdk({ allowEmptyBranchAdmission: true });
    sdk.hooks.childSources.RssOriginalRecoverySurface = source;
    sdk.deps.RssOriginalRecoverySurface = createReaderBuilderProbe(source, boundedMembers(source),
      { ...sdk.deps, rssOriginalMatchesScope }, sdk.hooks).Component;
    return sdk;
  }

  function mountRecovery(value, source = read('features/rss/ui/RssOriginalRecoverySurface.ets')) {
    const sdk = sdkWithRecovery(source);
    const calls = [];
    const owner = sdk.consumer(source, boundedMembers(source), { rssOriginalMatchesScope }, {
      original: value, scope: value.scope, subscriptionId: value.subscriptionId, guid: value.guid,
      presentationIdentity: 'current-presentation',
    });
    Object.assign(owner, {
      onReconcileOriginal: expected => calls.push(['reconcile', expected]),
      onContinueOriginal: expected => calls.push(['continue', expected]),
    });
    owner.aboutToAppear(); owner.initialRender(); sdk.properties.flush();
    const actions = () => sdk.walk(owner).filter(view => view instanceof sdk.deps.ReaderRecoveryAction);
    const button = action => [...action.nodes.values()].find(node => node.type === 'Button' && node.onClick);
    return { sdk, owner, calls, actions, button };
  }

  for (const id of selected) {
    if (id === 'management-overlay') {
      const { actualReaderPageLayout } = await import('./lib/reader-page-shell-runtime-probe.mjs');
      const { createDefaultReaderWindowMetrics } = await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
      const { projectPersistedReceipt } = await import('../entry/src/main/ets/app/ReaderPersistedReceiptProjection.ts');
      const { createRequire } = await import('node:module');
      const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
      const syntax = createRequire(import.meta.url)(resolveEtsLoaderRoot() + '/lib/validate_ui_syntax.js');
      const source = read('features/rss/ui/RssSubscriptionManagementPage.ets');
      const tree = parse(source, 'RssSubscriptionManagementPage.ets');
      const receipt = projectPersistedReceipt({ confirmation: 'unknown', readback: 'failed', generation: 7, canRetry: true });
      const operation = { original: original('management'), projection: receipt };
      const methods = ['build', 'subscriptionList', 'pageContent', 'operationFeedback', 'pendingRecovery', 'operation',
        'readFacts', 'items', 'presentationIdentity', 'pageScroller', 'hasOperationFeedback', 'feedbackMessage',
        'canRetryFeedback', 'retryFeedback'];
      function create(code = source, props = {}) {
        const sdk = sdkWithRecovery(), calls = [];
        sdk.hooks.childSources.PageBackBar = read('ui/chrome/PageBackBar.ets');
        syntax.builderParamObjectCollection.set('PageBackBar', new Set(['trailing']));
        sdk.deps.PageBackBar = class {
          constructor(owner, params, _storage, id) { Object.assign(this, params, { owner, params, id }); }
          updateStateVars(params) { Object.assign(this, params); }
          initialRender() {}
        };
        const metrics = createDefaultReaderWindowMetrics();
        Object.assign(metrics.windowRect, { width: 366, height: 844 });
        metrics.systemInsets.top = 24; metrics.navigationInsets.bottom = 24;
        const owner = sdk.consumer(code, methods, {
          ...actualReaderPageLayout(), rssOriginalMatchesScope,
          readerWindowMetrics: () => metrics, ReaderWindowCoordinator: { metrics: () => metrics },
          ViewStackProcessor: { StartGetAccessRecordingFor() {}, StopGetAccessRecording() {} },
          Repeat(items) { return {
            each(generator) { this.generator = generator; return this; }, key() { return this; },
            virtualScroll() { return this; },
            render() { assert.equal(items.length, 0, 'this recovery test does not simulate subscription rows'); },
          }; },
        }, { items: [], operation, readFacts: successfulRead(), presentationIdentity: 'management-current', ...props });
        Object.assign(owner, { backBar() {}, stats() {},
          onReconcileOriginal: expected => calls.push(['reconcile', expected]),
          onContinueOriginal: expected => calls.push(['continue', expected]),
          onRetryRead: facts => calls.push(['read', facts.generation]) });
        owner.initialRender(); sdk.properties.flush();
        // Native ListItem schedules its SDK-emitted body lazily. Materialize
        // each captured body once without replacing the production chain.
        for (const actor of sdk.walk(owner)) for (const node of [...actor.nodes.values()]) {
          if (node.type === 'ListItem' && typeof node.create?.[0] === 'function') node.create[0](node.id, true);
        }
        sdk.properties.flush();
        const standard = sdk.walk(owner).find(child => typeof child.recordMeasurement === 'function');
        assert.ok(standard, 'actual management build mounts StandardPage');
        return { owner, standard, sdk, calls };
      }
      const surface = model => model.sdk.walk(model.owner).filter(view => view instanceof model.sdk.deps.RssOriginalRecoverySurface);
      const carrier = model => [...model.standard.nodes.values()].find(node => node.type === 'Scroll' && node.onTouch);
      const resize = (model, width, height, header) => {
        const area = [...model.standard.nodes.values()].find(node => node.onAreaChange)?.onAreaChange;
        assert.equal(typeof area, 'function'); area({}, { width, height });
        model.standard.recordMeasurement('standard:header', header, model.standard.measurementKey);
        model.sdk.properties.flush();
      };
      const model = create();
      assert.equal(surface(model).length, 0, 'cold native-list flow contains no original recovery');
      assert.equal(carrier(model), undefined);
      assert.equal(model.sdk.walk(model.owner).filter(view => view instanceof model.sdk.deps.ReaderPageState).length, 1,
        'the ordinary empty list PageState remains in its native list ' + JSON.stringify({
          fact: model.owner.readFacts.fact, items: model.owner.items.length, scrollOwner: model.standard.scrollOwner,
          nodes: model.sdk.nodes(model.owner).map(node => node.type),
        }));
      const scroller = model.standard.scroller;
      resize(model, 366, 844, 58);
      const currentSurface = surface(model); assert.equal(currentSurface.length, 1);
      const scroll = carrier(model); assert.ok(scroll);
      const before = JSON.stringify(model.standard.geometry), measurementKey = model.standard.measurementKey;
      assert.equal(scroll.margin.top, model.standard.geometry.content.startInset);
      resize(model, 320, 320, 116); assert.equal(carrier(model), scroll);
      assert.equal(scroll.margin.top, model.standard.geometry.content.startInset);
      assert.equal(scroll.width, model.standard.geometry.content.frame.width);
      assert.ok(scroll.margin.top + scroll.constraintSize.maxHeight <= model.standard.geometry.footer.top);
      assert.equal(model.standard.scroller, scroller, 'the native list retains its scroll owner');
      const geometryBeforeActions = JSON.stringify(model.standard.geometry), keyBeforeActions = model.standard.measurementKey;
      const actions = model.sdk.walk(model.owner).filter(view => view instanceof model.sdk.deps.ReaderRecoveryAction);
      assert.equal(actions.length, 2);
      const buttons = actions.map(action => [...action.nodes.values()].find(node => node.type === 'Button' && node.onClick));
      buttons.forEach(button => button.onClick());
      assert.deepEqual(model.calls.map(call => [call[0], call[1].operationId]),
        [['reconcile', 'original-operation'], ['continue', 'original-operation']]);
      currentSurface[0].presentationIdentity = 'successor-management';
      buttons.forEach(button => button.onClick()); assert.equal(model.calls.length, 2);
      currentSurface[0].aboutToDisappear(); buttons.forEach(button => button.onClick());
      assert.equal(model.calls.length, 2, 'retired management recovery cannot dispatch its previous tuple');
      assert.equal(JSON.stringify(model.standard.geometry), geometryBeforeActions);
      assert.equal(model.standard.measurementKey, keyBeforeActions, 'recovery status cannot become page geometry input');
      assert.notEqual(before, JSON.stringify(model.standard.geometry), 'actual viewport resize updates geometry');
      assert.ok(model.standard.measurementKey > measurementKey);

      const readFailure = create(source, { operation: undefined,
        readFacts: projectOperationFacts({ phase: 'failed', error: 'read failure', generation: 12, canRetry: true }) });
      assert.equal(surface(readFailure).length, 0); assert.equal(carrier(readFailure), undefined);
      const ordinary = readFailure.sdk.walk(readFailure.owner).find(view => view instanceof readFailure.sdk.deps.ReaderRecoveryAction);
      assert.ok(ordinary); const ordinaryButton = [...ordinary.nodes.values()].find(node => node.type === 'Button' && node.onClick);
      ordinaryButton.onClick(); assert.deepEqual(readFailure.calls, [['read', 12]]);
      readFailure.owner.readFacts = projectOperationFacts({ phase: 'failed', generation: 13, canRetry: true });
      ordinaryButton.onClick(); assert.deepEqual(readFailure.calls, [['read', 12]]);
      const noOriginal = create(source, { operation: undefined }); resize(noOriginal, 366, 844, 58);
      assert.equal(carrier(noOriginal), undefined, 'a completed or absent original owns no hit layer');
      for (const scope of ['editor', 'entry', 'foreign']) {
        const foreign = create(source, { operation: { ...operation, original: original(scope) } });
        resize(foreign, 366, 844, 58); assert.equal(carrier(foreign), undefined);
      }
      const previous = historical().sources.find(record => record.owner === 'RssSubscriptionManagementPage');
      const method = member(tree, 'operationFeedback');
      const oldSource = source.slice(0, method.getStart(tree)) + previous.method + source.slice(method.end);
      const old = create(oldSource);
      assert.equal(surface(old).length, 1, 'the captured original operationFeedback mounts recovery in the cold native-list body');
      console.log('RSS management original recovery leaves native-list flow through the actual build, retains read/empty feedback, current tuple actions, and a live bounded carrier. Header/row bodies are finite ports. Native removal, focus, hit and pixels are not executed.');
    }
    if (id === 'home-scope') {
      const gatewaySource = read('features/rss/application/RssGateway.ts');
      const runtime = { supportsCoreCapability: () => true, request() { assert.fail('scope projection cannot perform RPC'); } };
      let state;
      const { RssGateway } = pureModuleProbe(gatewaySource, 'RssGateway.ts', {
        ReaderRuntimeOwner: { current: () => runtime },
        RulesMutationOwner: { forRuntime: () => ({ snapshot: () => state }) },
      }, ['RssGateway']);
      const gateway = new RssGateway(runtime);
      const scopes = new Set();
      for (const method of ['rss-source.put', 'rss-source.import', 'rss.subscription.persist', 'rss.subscription.remove',
        'rss.entry.read', 'rss.favorite.persist', 'rss.favorite.remove', 'other.method']) {
        state = { ...original(), original: { method, params: { subscriptionId: 'subscription', guid: 'entry', params: { subscriptionId: 'subscription' } } } };
        const projection = gateway.originalMutationSnapshot();
        assert.ok(projection); scopes.add(projection.scope);
        assert.equal(rssOriginalMatchesScope(projection, 'feed'), false);
      }
      state = { ...original(), original: undefined };
      const damaged = gateway.originalMutationSnapshot();
      assert.equal(damaged.scope, 'foreign');
      assert.equal(rssOriginalMatchesScope(damaged, 'feed'), false);
      assert.deepEqual([...scopes].sort(), ['editor', 'entry', 'foreign', 'management']);

      const homeSource = read('features/rss/ui/RssPage.ets');
      const homeTree = parse(homeSource, 'RssPage.ets');
      assert.ok(!homeSource.includes('RssOriginalRecoverySurface'), 'unreachable feed-owned recovery is retired');
      for (const path of ['feedScroll', 'emptyUnreadScroll']) {
        assert.match(member(homeTree, path).getText(homeTree), /this\.readFeedback\(\)/);
        for (const scope of scopes) assert.equal(rssOriginalMatchesScope(original(scope), 'feed'), false);
      }
      const sdk = sdkWithRecovery();
      const calls = [];
      const owner = sdk.consumer(homeSource, ['readFeedback', 'readFacts'], { readerRecoveryView, projectOperationFacts }, {
        readFacts: projectOperationFacts({ phase: 'failed', error: 'read failure', generation: 9, canRetry: true }),
      });
      owner.onRetryRead = facts => calls.push(facts.generation);
      owner.readFeedback(); sdk.properties.flush();
      const stateView = sdk.walk(owner).find(view => view instanceof sdk.deps.ReaderPageState);
      assert.ok(stateView, 'ordinary read failure remains content feedback');
      const retry = stateView.onAction;
      retry(); assert.deepEqual(calls, [9]);
      owner.readFacts = projectOperationFacts({ phase: 'failed', error: 'new failure', generation: 10, canRetry: true });
      retry(); assert.deepEqual(calls, [9], 'the ordinary read action rejects an old generation');
      console.log('RSS home scope proof covers four legitimate original scopes and two real content paths; cleanup adds no new viewport state.');
    }

    if (id === 'editor-overlay') {
      const source = read('features/rss/ui/RssSubscriptionEditorPage.ets');
      const tree = parse(source, 'RssSubscriptionEditorPage.ets');
      const orchestrator = read('features/rss/application/RssSubscriptionEditorOrchestrator.ets');
      const defaultsTree = parse(orchestrator, 'RssSubscriptionEditorOrchestrator.ets');
      const defaults = defaultsTree.statements.find(node => ts.isVariableStatement(node) &&
        node.declarationList.declarations.some(declaration => declaration.name.getText(defaultsTree) === 'EMPTY_RSS_EDITOR_SNAPSHOT'));
      const { EMPTY_RSS_EDITOR_SNAPSHOT } = pureModuleProbe(defaults.getText(defaultsTree), 'RssEditorDefaults.ts',
        { projectOperationFacts }, ['EMPTY_RSS_EDITOR_SNAPSHOT']);
      const snapshot = { ...EMPTY_RSS_EDITOR_SNAPSHOT, subscriptionId: 'subscription', original: original(), readFacts: successfulRead() };
      const methods = ['snapshot', 'presentationIdentity', 'operationRecovery', 'pendingRecovery',
        'recoveryActionIdentities', 'recoveryGeneration', 'dispatchRecovery'];
      const create = code => {
        const sdk = sdkWithRecovery();
        const calls = [];
        const owner = sdk.consumer(code, methods, { rssOriginalMatchesScope, EMPTY_RSS_EDITOR_SNAPSHOT }, { snapshot, presentationIdentity: 'current-presentation' });
        Object.assign(owner, { onReconcileOriginal: expected => calls.push(['reconcile', expected]),
          onContinueOriginal: expected => calls.push(['continue', expected]), onRetryRead: generation => calls.push(['read', generation]) });
        return { sdk, owner, calls };
      };
      const flow = create(source); flow.owner.operationRecovery(); flow.sdk.properties.flush();
      assert.equal(flow.sdk.walk(flow.owner).filter(view => view instanceof flow.sdk.deps.RssOriginalRecoverySurface).length, 0,
        'original recovery cannot enter form content');

      const constructors = [];
      function visit(node) {
        if ((ts.isCallExpression(node) || ts.isEtsComponentExpression(node)) && node.expression.getText(tree) === 'ReaderStandardPage') constructors.push(node);
        ts.forEachChild(node, visit);
      }
      visit(member(tree, 'build')); assert.equal(constructors.length, 1);
      const properties = constructors[0].arguments[0].properties;
      const visible = properties.find(property => property.name?.getText(tree) === 'boundedOverlayVisible');
      const content = properties.find(property => property.name?.getText(tree) === 'boundedOverlayContent');
      assert.ok(visible); assert.ok(content);
      const enabled = sourceExpression(visible.initializer.getText(tree));
      assert.equal(enabled.call({ snapshot }), true);
      for (const next of [{ ...snapshot, original: undefined }, { ...snapshot, subscriptionId: 'other' },
        { ...snapshot, original: original('entry') }, { ...snapshot, original: original('foreign') }])
        assert.equal(enabled.call({ snapshot: next }), false, 'empty and foreign originals cannot own a hit layer');
      assert.match(content.initializer.getText(tree), /this\.pendingRecovery\(\)/);

      const overlay = create(source); overlay.owner.pendingRecovery(); overlay.sdk.properties.flush();
      const surface = overlay.sdk.walk(overlay.owner).find(view => view instanceof overlay.sdk.deps.RssOriginalRecoverySurface);
      assert.ok(surface);
      const actions = overlay.sdk.walk(overlay.owner).filter(view => view instanceof overlay.sdk.deps.ReaderRecoveryAction);
      assert.equal(actions.length, 2);
      for (const action of actions) [...action.nodes.values()].find(node => node.type === 'Button' && node.onClick).onClick();
      assert.deepEqual(overlay.calls.map(call => [call[0], call[1].operationId]), [['reconcile', 'original-operation'], ['continue', 'original-operation']]);
      surface.aboutToDisappear();
      for (const action of actions) [...action.nodes.values()].find(node => node.type === 'Button' && node.onClick).onClick();
      assert.equal(overlay.calls.length, 2, 'retired original action callbacks stop at their original surface');

      const ordinary = create(source);
      ordinary.owner.snapshot = { ...snapshot, original: undefined,
        readFacts: projectOperationFacts({ phase: 'failed', error: 'read failure', generation: 12, canRetry: true }) };
      ordinary.owner.operationRecovery(); ordinary.sdk.properties.flush();
      const readAction = ordinary.sdk.walk(ordinary.owner).find(view => view instanceof ordinary.sdk.deps.ReaderRecoveryAction);
      assert.ok(readAction);
      const readButton = [...readAction.nodes.values()].find(node => node.type === 'Button' && node.onClick);
      readButton.onClick(); assert.deepEqual(ordinary.calls, [['read', 12]]);
      ordinary.owner.snapshot = { ...ordinary.owner.snapshot, readFacts: projectOperationFacts({ phase: 'failed', generation: 13, canRetry: true }) };
      readButton.onClick(); assert.deepEqual(ordinary.calls, [['read', 12]]);

      const before = historical().sources.find(record => record.owner === 'RssSubscriptionEditorPage');
      const method = member(tree, 'operationRecovery');
      const previous = source.slice(0, method.getStart(tree)) + before.method + source.slice(method.end);
      const old = create(previous); old.owner.operationRecovery(); old.sdk.properties.flush();
      assert.equal(old.sdk.walk(old.owner).filter(view => view instanceof old.sdk.deps.RssOriginalRecoverySurface).length, 1,
        'the exact historical e81 operationRecovery method mounts the original recovery in form flow');
      console.log('RSS editor keeps original recovery in its bounded slot and preserves ordinary actions; the real historical flow method is rejected.');
    }

    if (id === 'stable-identity') {
      const value = original();
      const fixture = mountRecovery(value);
      const key = fixture.owner.identities()[0], actors = fixture.actions();
      assert.equal(actors.length, 2);
      fixture.owner.original = { ...value, busy: true, message: '正在核对原回执' };
      assert.equal(fixture.owner.identities()[0], key, 'busy/message do not become operation identity');
      fixture.sdk.properties.flush();
      fixture.actions().forEach((actor, index) => assert.equal(actor, actors[index]));
      for (const actor of actors) {
        assert.equal(fixture.button(actor).enabled, false);
        fixture.button(actor).onClick();
      }
      assert.equal(fixture.calls.length, 0);
      fixture.owner.original = { ...value, confirmation: 'confirmed', writeStage: 'cleanup', message: '原清理待完成' };
      fixture.sdk.properties.flush();
      fixture.actions().forEach((actor, index) => assert.equal(actor, actors[index]));
      assert.equal(actors[1].label, '继续原清理', 'mutable continuation facts use current owner projection');
      fixture.button(actors[1]).onClick(); assert.equal(fixture.calls.length, 1);
      assert.deepEqual(Object.keys(fixture.calls[0][1]).sort(), ['generation', 'guid', 'method', 'operationId', 'scope', 'subscriptionId']);
      fixture.owner.original = { ...value, canRetryOriginal: false };
      fixture.button(actors[1]).onClick(); assert.equal(fixture.calls.length, 1, 'current retry permission retires an old callback immediately');

      for (const patch of [{ original: original('editor', { operationId: 'next-operation' }) },
        { original: original('editor', { generation: 8 }) }, { presentationIdentity: 'next-presentation' },
        { scope: 'management' }, { subscriptionId: 'other-subscription' }]) {
        Object.assign(fixture.owner, { original: value, scope: 'editor', subscriptionId: 'subscription', presentationIdentity: 'current-presentation' }, patch);
        fixture.button(actors[0]).onClick(); fixture.button(actors[1]).onClick();
        assert.equal(fixture.calls.length, 1, 'superseded operation/page/entity cannot borrow the previous actor');
      }
      const initiallyUnavailable = mountRecovery(original('editor', { canRetryOriginal: false }));
      assert.equal(initiallyUnavailable.actions().length, 1);
      initiallyUnavailable.owner.original = value; initiallyUnavailable.sdk.properties.flush();
      assert.equal(initiallyUnavailable.actions().length, 2, 'new current retry qualification can admit its action without changing the original key');
      const oldSource = historical().sources.find(record => record.owner === 'RssOriginalRecoverySurface').source;
      const old = mountRecovery(value, oldSource);
      const oldKey = old.owner.identities()[0];
      old.owner.original = { ...value, busy: true, message: '正在核对原回执' };
      assert.notEqual(old.owner.identities()[0], oldKey, 'the original whole-projection key is a real negative');
      console.log('RSS shared recovery preserves keyed actors within one immutable identity and rejects superseded callbacks.');
    }
    recordContractCasePass(id);
  }
}
