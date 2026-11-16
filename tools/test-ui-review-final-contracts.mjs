import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boundedSurfaceSdk } from './lib/bounded-surface-sdk-probe.mjs';
import { selectedProductionMethods, selectedProductionComponentCallback } from './lib/selected-production-methods.mjs';
import { installedEtsCompiler } from './lib/ets-compiler-runtime.mjs';
import { readerControlHostInputEnabled } from '../entry/src/main/ets/features/reading/ui/ReaderControlHostSession.ts';
import { retainedReaderRoute } from '../entry/src/main/ets/app/navigation/ReaderNavigation.ts';
import { ReaderStartupContentOwner } from '../entry/src/main/ets/app/ReaderStartupContentOwner.ts';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const cases = selectContractCases({
  'failure-first-input': 'Actual text/cache/manga failure native callbacks reject a new retry after live Root input loss, recover on the same owner and retain accepted business retries.',
  'startup-font-admission': 'Exact Ability checked-font promise and actual startup owner preserve rejection before/during stage creation and admit a successful checked load.',
});
const root = new URL('../entry/src/main/ets/', import.meta.url);
const file = path => new URL(path, root);
const read = path => readFileSync(file(path), 'utf8');
const localPath = 'features/reading/ui/LocalReadingExperience.ets';
const mangaPath = 'features/manga/ui/MangaReadingSurface.ets';
const abilityPath = 'entryability/EntryAbility.ets';
const settle = async () => {
  for (let index = 0; index < 20; index += 1) await Promise.resolve();
};

function rootInput() {
  const Root = selectedProductionMethods(file('pages/Index.ets'), 'Index', ['readerContentInputCurrent'], { retainedReaderRoute });
  const Entry = selectedProductionMethods(file('features/reading/presentation/ReadingEntryPresentation.ets'),
    'ReadingEntryPresentation', ['readerPresentationIdentity']);
  const reading = Object.assign(new Entry(), { sessionActive: true, book: { sourceId: 'local', bookId: 'book' }, readyGeneration: 1 });
  const index = Object.assign(new Root(), {
    currentReadingRuntime: () => ({}), readingEntry: reading,
    currentReaderPresentationIdentity: () => reading.readerPresentationIdentity(),
    route: 'reading', directoryReturnTarget: 'readerControl', searchAppForeground: true, arkWebCapturesInput: false,
    shelfMotion: { pendingExitId: -1 }, sourceSwitchPresentation: { isSurfacePresented: () => false },
    mangaSourceSwitch: { selectionVisible: false },
  });
  const Shell = selectedProductionMethods(file('features/reading/ui/ReaderShell.ets'), 'ReaderShell',
    ['readingContentIsForeground', 'readingIdentityKey', 'mangaIdentityKey', 'isMangaSurfaceCurrent', 'acceptsMangaInput']);
  const scene = { ports: { inputCurrent: identity => index.readerContentInputCurrent(identity) } };
  const shell = Object.assign(new Shell(), {
    sourceId: 'local', bookId: 'book', readingReadyGeneration: 1, mangaChapterRequestGeneration: 0,
    contentKind: 'text', inputAllowed: true, visible: true, route: 'reading',
    sourceSwitchPresented: false, sourceSwitchCovered: false,
    inputCurrent: selectedProductionComponentCallback(file('app/composition/RetainedReaderScene.ets'), 'ReaderShell', 'inputCurrent', scene),
  });
  const inputFor = kind => {
    shell.contentKind = kind;
    const component = kind === 'text' ? 'ReadingExperience' : 'MangaReadingSurface';
    const identity = kind === 'text' ? shell.readingIdentityKey() : shell.mangaIdentityKey();
    return selectedProductionComponentCallback(file('features/reading/ui/ReaderShell.ets'), component, 'inputCurrent', shell, { _identity: identity });
  };
  return { index, inputFor };
}

async function failureFirstInput(localSource = read(localPath), mangaSource = read(mangaPath)) {
  const Local = selectedProductionMethods(file(localPath), 'ReadingExperience',
    ['readerInputIsCurrent', 'retryReading', 'reconcileReaderRecovery'], { readerControlSelectionOwnsReading: () => false, readerControlHostInputEnabled });
  const Manga = selectedProductionMethods(file(mangaPath), 'MangaReadingSurface', ['readerPanelForeground', 'retryOpen']);
  const samples = [];
  for (const kind of ['text', 'cache', 'manga']) {
    for (const loss of ['foreground', 'covered']) {
      const wiring = rootInput();
      let loads = 0;
      let resetCalls = 0;
      let recoveryClears = 0;
      const reader = Object.assign(kind === 'manga' ? new Manga() : new Local(), {
        mounted: true, exitRequested: false, exiting: false, appForeground: true, windowChromeActive: true,
        windowChromeOverlayActive: false, interactionBlocked: false, controlObscured: false,
        isReaderIdentityCurrent: () => true, inputCurrent: wiring.inputFor(kind === 'manga' ? 'manga' : 'text'),
        phase: 'failed', lifecycleToken: 1, chapterSelectionToken: 3, failureCode: 'failure',
        resetForChapterSelection: () => { resetCalls += 1; },
        armFirstPageReadyDeadline() {}, loadInitialReading: async () => { loads += 1; },
        readerRecoveryView: { visible: true, canRetry: true, generation: 7 }, readerRecoveryIdentity: 'current',
        readerRecoveryOwnerKey: () => 'current', showReaderRecovery: () => { recoveryClears += 1; },
        readerRecoveryAction: () => { loads += 1; },
        controller: { close: () => { resetCalls += 1; } }, opened: false, offline: false, openingRetry: false,
        open: async () => { loads += 1; },
      });
      const sdk = boundedSurfaceSdk();
      const ui = kind === 'manga'
        ? sdk.consumer(mangaSource, ['chapterLoadState'])
        : sdk.consumer(localSource, ['readingFailureActions'], { LOCAL_READING_SOURCE_ID: 'local' });
      Object.assign(ui, {
        sourceId: 'local', sourceSwitchFailureMessage: '',
        readerRecoveryView: { visible: kind === 'cache', canRetry: true, generation: 7 }, readerRecoveryActionLabel: '刷新本章',
        readerInputIsCurrent: () => reader.readerInputIsCurrent(), retryReading: () => reader.retryReading(),
        reconcileReaderRecovery: generation => reader.reconcileReaderRecovery(generation), openReaderControl() {},
        error: 'chapter failed', openingRetry: false, offline: false, openFailureStage: 'chapter',
        inkColor: () => '#000000', mutedColor: () => '#666666', displayError: value => value,
        interactiveInsets: () => ({}), readerPanelForeground: () => reader.readerPanelForeground(),
        retryOpen: () => reader.retryOpen(), openSourceSwitch() {},
      });
      if (kind === 'manga') ui.chapterLoadState();
      else ui.readingFailureActions();
      const action = sdk.nodes(ui).find(node => node.type === 'Button' && node.accessibilityText === (kind === 'cache' ? '刷新本章' : '重试'));
      assert.ok(action && typeof action.onClick === 'function', 'actual failure native action');
      if (loss === 'foreground') wiring.index.searchAppForeground = false;
      else wiring.index.arkWebCapturesInput = true;
      action.onClick();
      await settle();
      assert.equal(loads, 0, `${kind}/${loss} cannot first retry after live loss`);
      assert.equal(resetCalls, 0);
      assert.equal(recoveryClears, 0);
      assert.equal(reader.chapterSelectionToken, 3);
      wiring.index.searchAppForeground = true;
      wiring.index.arkWebCapturesInput = false;
      action.onClick();
      await settle();
      assert.equal(loads, 1, `${kind}/${loss} same owner recovers`);
      if (kind === 'text') {
        wiring.index.searchAppForeground = false;
        reader.retryReading();
        assert.equal(loads, 2, 'accepted business retry keeps its original entry while background');
      }
      samples.push({ kind, loss });
    }
  }
  return { samples, actualNativeActions: 6, acceptedBusinessRetryRetained: true };
}

async function startupFontAdmission(source = read(abilityPath)) {
  const { ts } = installedEtsCompiler();
  const start = source.indexOf('    this.shelfFontsReady = trace.measure');
  const end = source.indexOf('    // Selection diagnostics', start);
  assert.ok(start > 0 && end > start);
  const preparation = ts.transpileModule(source.slice(start, end), {
    compilerOptions: { target: ts.ScriptTarget.ES2021 }, reportDiagnostics: true,
  });
  assert.deepEqual(preparation.diagnostics, []);
  const trace = { current: () => undefined, measure: (_name, action) => action() };
  const Ability = selectedProductionMethods(file(abilityPath), 'EntryAbility', ['onWindowStageCreate', 'loadMainContent'], {
    ReaderStartupTrace: trace, ReaderStartupContentOwner,
    ReaderWindowCoordinator: { install: async () => true }, DOMAIN: 0, hilog: { error() {}, warn() {} },
  });
  const samples = [];
  for (const timing of ['rejected-before-stage', 'rejected-during-stage', 'checked-success']) {
    let acceptFonts;
    let rejectFonts;
    let logged = 0;
    const fonts = new Promise((resolve, reject) => { acceptFonts = resolve; rejectFonts = reject; });
    const requests = [];
    const ability = Object.assign(new Ability(), {
      context: { config: {}, terminateSelf: async () => {} }, recoveryReady: Promise.resolve(),
      windowStageGeneration: 0, coldStartPage: 'pages/Index',
    });
    new Function('trace', 'prepareReaderShelfFonts', 'hilog', 'DOMAIN', preparation.outputText)
      .call(ability, trace, () => fonts, { error: () => { logged += 1; } }, 0);
    if (timing === 'rejected-before-stage') {
      rejectFonts(new Error('checked face failed'));
      await settle();
    }
    const stage = {
      getMainWindowSync: () => ({}),
      loadContent: (page, done) => { requests.push(page); done({ code: 0 }); },
    };
    ability.onWindowStageCreate(stage);
    if (timing === 'checked-success') acceptFonts();
    if (timing === 'rejected-during-stage') rejectFonts(new Error('checked face failed'));
    await settle();
    try {
      assert.deepEqual(requests, [timing === 'checked-success' ? 'pages/Index' : 'pages/ReaderStartupRecovery'],
        `${timing} uses the checked-font admission result`);
      assert.equal(logged, timing === 'checked-success' ? 0 : 1);
      assert.equal(ability.startupContent.snapshot().phase, timing === 'checked-success' ? 'ready' : 'recovery');
      samples.push(timing);
    } finally {
      ability.startupContent.close();
    }
  }
  return { samples };
}

for (const id of cases) {
  let result;
  if (id === 'failure-first-input') {
    const local = read(localPath);
    const manga = read(mangaPath);
    result = await failureFirstInput(local, manga);
    const oldLocal = local.replaceAll('if (this.readerInputIsCurrent()) this.reconcileReaderRecovery(generation);', 'this.reconcileReaderRecovery(generation);')
      .replaceAll('if (this.readerInputIsCurrent()) this.retryReading();', 'this.retryReading();');
    const oldManga = manga.replace('if (this.readerPanelForeground()) void this.retryOpen();', 'void this.retryOpen();');
    await assert.rejects(() => failureFirstInput(oldLocal, manga), /cannot first retry after live loss/);
    await assert.rejects(() => failureFirstInput(local, oldManga), /cannot first retry after live loss/);
  } else {
    const source = read(abilityPath);
    result = await startupFontAdmission(source);
    const old = source.replace("this.shelfFontsReady = trace.measure('startup.shelf-fonts', (): Promise<void> => prepareReaderShelfFonts());\n    void this.shelfFontsReady.catch",
      "this.shelfFontsReady = trace.measure('startup.shelf-fonts', (): Promise<void> => prepareReaderShelfFonts()).catch");
    assert.notEqual(old, source);
    await assert.rejects(() => startupFontAdmission(old), /uses the checked-font admission result/);
  }
  console.log(JSON.stringify({ case: id, result, oldBehaviorRejected: true,
    boundary: 'Current production methods and actual SDK native action callbacks. Acquisition, native layout and platform IO are finite ports. No device action.' }));
  recordContractCasePass(id);
}
