import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { installedEtsCompiler } from './lib/ets-compiler-runtime.mjs';
import { boundedSurfaceSdk } from './lib/bounded-surface-sdk-probe.mjs';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';

const selected = selectContractCases({
  'header-stability': {
    description: 'Standalone text catalog header and native panel allocation retain their admitted frame while the original recovery facts change.',
    resources: [],
  },
  'foreground-succession': {
    description: 'Text and manga catalog foregrounds yield the original recovery presentation, retain owner facts and reject closed-editor actions.',
    resources: [],
  },
});

registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); } catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier))
      return next(specifier + '.ts', context);
    throw error;
  }
} });

const root = new URL('../entry/src/main/ets/', import.meta.url);
const read = relative => readFileSync(new URL(relative, root), 'utf8');
const textSource = read('features/reading/ui/ReaderFullDirectory.ets');
const mangaSource = read('features/reading/ui/BookDirectoryPage.ets');
const metricsApi = await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
const geometryApi = await import('../entry/src/main/ets/ui/layout/ReaderPageGeometry.ts');
const support = {
  ...metricsApi, ...geometryApi,
  ...await import('../entry/src/main/ets/ui/layout/ReaderMeasurements.ts'),
  ...await import('../entry/src/main/ets/ui/foundation/ReaderWidthClass.ts'),
  ...await import('../entry/src/main/ets/features/reading/presentation/ReadingDirectoryRecovery.ts'),
  ...await import('../entry/src/main/ets/features/reading/application/ReaderDirectoryNavigation.ts'),
};
const { ts, options } = installedEtsCompiler();
const parse = (source, name) => ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
const declaration = tree => tree.statements.find(node => ts.isStructDeclaration(node));
const nonBuilders = tree => declaration(tree).members.filter(member => member.name && member.name.getText(tree) !== 'build' &&
  !ts.getAllDecorators(member).some(decorator => decorator.getText(tree) === '@Builder')).map(member => member.name.getText(tree));
const recovery = (phase, generation = 7) => ({ presentationId: 'original-presentation',
  bookmarks: { visible: phase !== 'none', generation, canRetry: phase !== 'reading', message: `Original ${phase}` },
  bookmarksKind: 'pending', bookmarksBusy: phase === 'reading', bookmarksRecoveryAction: phase === 'reading' ? 'reconcile' : undefined,
  offline: support.EMPTY_READING_DIRECTORY_RECOVERY.offline, canContinueBookmarks: phase !== 'reading', canContinueOffline: false,
  bookmarkWriteEnabled: false });

function mountedText(source, width = 366, height = 844, context = 'detail') {
  const metrics = metricsApi.createDefaultReaderWindowMetrics();
  metrics.windowRect.width = width; metrics.windowRect.height = height;
  const frames = [], sdk = boundedSurfaceSdk({ windowMetrics: () => metrics });
  const classes = pureModuleProbe(source.slice(source.indexOf('class DirectoryRulesFocusFrame'),
    source.indexOf('let fullDirectoryBackGeneration')), 'DirectoryFrames.ets', { FrameCallback: class {} },
  ['DirectoryRulesFocusFrame', 'FullDirectoryHeaderMeasurementFrame']);
  const tree = parse(source, 'ReaderFullDirectory.ets');
  const members = nonBuilders(tree);
  members.push('directoryHeader', 'topBar', 'topBarBack', 'topBarBackIcon', 'topBarActions', 'topBarSourceContent', 'topBarMoreIcon');
  const owner = sdk.consumer(source, members, { ...support, ...classes,
    fullDirectoryBackGeneration: 0, ReaderRuntimeOwner: { current: () => undefined }, registerReaderFonts() {},
    uiContext: { getFont: () => ({}), postFrameCallback: frame => frames.push(frame),
      getComponentUtils: () => ({ getRectangleById() { throw Error('Native measurement is outside this exact contract'); } }) } });
  const calls = { recovery: 0, rules: 0 };
  Object.assign(owner, { containerWidth: width, containerHeight: height, sourceId: 'local', bookId: 'original-book', bookKind: 'epub',
    bookTitle: 'Book', chapterTitle: 'Chapter', catalogContext: context,
    // These two rendering ports expose only their parent's placement. Their
    // business, busy and callback contracts retain the independent UI/owner proof.
    recoveryContent() { calls.recovery++; }, directoryRulesNotice() { calls.rules++; } });
  owner.aboutToAppear();
  owner.acceptHeaderHeight(owner.headerBarHeight(), owner.measurementKey);
  owner.directoryHeader(); sdk.properties.flush();
  return { owner, sdk, metrics, calls, frames };
}

export function verifyTextHeader(source = textSource) {
  let samples = 0;
  for (const width of [294, 366, 760]) for (const height of [320, 844]) for (const context of ['detail', 'reader']) {
    const { owner, sdk, metrics, calls } = mountedText(source, width, height, context);
    const key = owner.measurementKey;
    const top = owner.fullPanelTop(), panelHeight = owner.fullPanelHeight();
    const header = owner.geometry.header.height;
    const actors = [...owner.nodes.values()];
    assert.equal(calls.recovery, 0, 'header never mounts an original-operation recovery card');
    assert.equal(calls.rules, 0, 'header never mounts the rules editor recovery card');
    for (const phase of ['pending', 'reading', 'failed', 'none']) {
      owner.directoryRecovery = recovery(phase); sdk.properties.flush();
      assert.equal(owner.measurementKey, key, 'recovery facts do not replace the header measurement generation');
      assert.equal(owner.headerLayoutReady(), true, 'recovery transitions do not withdraw directory input');
      assert.equal(owner.geometry.header.height, header);
      assert.equal(owner.fullPanelTop(), top);
      assert.equal(owner.fullPanelHeight(), panelHeight);
      assert.equal(owner.bookmarkWriteEnabled(), false, 'the original owner keeps write admission blocked');
      const currentActors = [...owner.nodes.values()];
      assert.equal(currentActors.length, actors.length, 'the header keeps its original actor count');
      currentActors.forEach((actor, index) => {
        assert.equal(actor, actors[index], 'the same header actor remains mounted');
      });
    }
    owner.directoryRecovery = { ...recovery('none'), bookmarkWriteEnabled: true };
    assert.equal(owner.bookmarkWriteEnabled(), true);
    metrics.systemFontScale = 2; metrics.revision++;
    owner.readerWindowMetricsRevision += 1; sdk.properties.flush();
    assert.ok(owner.measurementKey > key, 'the original viewport/font invalidation remains active');
    samples++;
  }
  return samples;
}

function verifyForegroundDeclarations(source, name) {
  const tree = parse(source, name); assert.deepEqual(tree.parseDiagnostics, []);
  const calls = [];
  const visit = node => {
    if ((ts.isCallExpression(node) || ts.isEtsComponentExpression(node)) && node.expression.getText(tree) === 'ReaderDirectoryRecoverySurface')
      calls.push(node);
    ts.forEachChild(node, visit);
  };
  visit(tree); assert.equal(calls.length, 0, `${name}: foreground catalog yields the original recovery projection`);
  const component = declaration(tree);
  for (const property of ['directoryRecovery', 'onReconcileBookmarks', 'onContinueBookmarks', 'onReconcileOffline', 'onContinueOffline'])
    assert.ok(component.members.some(member => member.name?.getText(tree) === property), `${name}: retains parent contract ${property}`);
  return tree;
}

function verifyRulesNotice(source) {
  const sdk = boundedSurfaceSdk();
  let reconciled = 0, continued = 0;
  const owner = sdk.consumer(source, ['directoryRulesVisible', 'directoryRulesRecovery', 'directoryRulesNotice'], {},
    { directoryRulesVisible: true });
  const fact = { bookId: 'book', identity: 'same-rule-operation', view: { message: 'Original rule write', visible: true, canRetry: true, generation: 4 },
    actionLabel: '核对规则', secondaryActionLabel: '继续原规则', busy: false,
    onReconcile: () => reconciled++, onSecondaryAction: () => continued++ };
  Object.assign(owner, { directoryRulesCurrent: () => true, directoryRulesRecovery: fact });
  owner.directoryRulesNotice('opening', fact); sdk.properties.flush();
  const buttons = sdk.nodes(owner).filter(node => node.type === 'Button' && typeof node.onClick === 'function');
  assert.equal(buttons.length, 2);
  buttons[0].onClick(); buttons[1].onClick(); assert.deepEqual([reconciled, continued], [1, 1]);
  owner.directoryRulesVisible = false;
  buttons[0].onClick(); buttons[1].onClick();
  assert.deepEqual([reconciled, continued], [1, 1], 'closed editor rejects already queued actions before native repaint');
  owner.directoryRulesVisible = true;
  owner.directoryRulesRecovery = { ...fact, identity: 'successor-rule-operation' };
  buttons[0].onClick(); buttons[1].onClick();
  assert.deepEqual([reconciled, continued], [1, 1], 'old editor callback cannot borrow a successor operation');
}

for (const id of selected) {
  if (id === 'header-stability') {
    console.log(JSON.stringify({ case: id, samples: verifyTextHeader(),
      boundary: 'Actual installed-SDK property lifecycle and parent header/geometry methods; native recovery rendering is a finite placement port, no renderer or device execution.' }));
  }
  if (id === 'foreground-succession') {
    const textTree = verifyForegroundDeclarations(textSource, 'ReaderFullDirectory.ets');
    const mangaTree = verifyForegroundDeclarations(mangaSource, 'BookDirectoryPage.ets');
    const textComponent = declaration(textTree), mangaComponent = declaration(mangaTree);
    assert.ok(!textComponent.members.some(member => member.name?.getText(textTree) === 'onHeaderRecoveryChanged'));
    assert.ok(!mangaComponent.members.some(member => member.name?.getText(mangaTree) === 'pageRecoveryOverlay'));
    const localRules = textComponent.members.find(member => member.name?.getText(textTree) === 'directoryRulesLayer');
    assert.ok(localRules.getText(textTree).includes('this.directoryRulesNotice(identity, this.directoryRulesRecovery)'));
    const header = textComponent.members.find(member => member.name?.getText(textTree) === 'directoryHeader');
    assert.ok(!header.getText(textTree).includes('directoryRulesNotice'));
    verifyRulesNotice(textSource);
    const oldClosedAction = textSource.replaceAll('this.directoryRulesVisible && this.directoryRulesCurrent(identity, recovery.bookId)',
      'this.directoryRulesCurrent(identity, recovery.bookId)');
    assert.notEqual(oldClosedAction, textSource);
    assert.throws(() => verifyRulesNotice(oldClosedAction), /closed editor rejects/);
    console.log(JSON.stringify({ case: id, foregrounds: ['text-detail', 'text-reader', 'manga'],
      boundary: 'Actual ETS declarations and SDK shared notice actions; no original receipt mutation, native layout or platform focus proof.' }));
  }
  recordContractCasePass(id);
}
