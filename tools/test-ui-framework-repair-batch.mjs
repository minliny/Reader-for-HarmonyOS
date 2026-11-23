import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { selectedProductionMethods, selectedProductionClasses, selectedProductionComponentCallback } from './lib/selected-production-methods.mjs';
import { installedEtsCompiler } from './lib/ets-compiler-runtime.mjs';
import { ReaderAutoPageCoordinator } from '../entry/src/main/ets/features/reading/ui/ReaderAutoPageCoordinator.ts';

const root = new URL('../entry/src/main/ets/', import.meta.url);
const file = path => new URL(path, root);
const read = path => readFileSync(file(path), 'utf8');
const drain = async () => { for (let i = 0; i < 80; i++) await Promise.resolve(); };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const definitions = {
  'source-modal-observer': { description: 'Actual Index/Surface expressions and SDK Page/Button/Toggle reactive restoration', resources: [] },
  'download-progress-handoff': { description: 'Full actual Host: old progress read, same Host reload, new pending notification, retirement', resources: [] },
  'bookshelf-current-group': { description: 'Actual retained action and sheet dismissal dispatch use current DTO', resources: [] },
  'bookshelf-batch-notify': { description: 'Actual RowDataSource batch-only API and current position/data', resources: [] },
  'autopage-paused-pending': { description: 'Actual Coordinator pending intent across pause, inactive/ready, ACK and stop', resources: [] },
  'autopage-window-unlock': { description: 'Actual LRE Window method wakes before preference ACK, generation fenced', resources: [] },
};

function autoFixture(sync = false) {
  let now = 10000, serial = 0;
  const timers = new Map();
  const view = { active: true, ready: true, resumable: true, turns: 0, outcome: 'preparing' };
  const owner = new ReaderAutoPageCoordinator({ now: () => now,
    schedule(fn, ms) { const id = ++serial; timers.set(id, { fn, at: now + ms }); return id; },
    cancel: id => timers.delete(id), active: () => view.active, ready: () => view.ready,
    canResumeTurn: () => view.resumable, changed() {}, turn() {
      view.turns++;
      if (sync && view.outcome === 'started') { owner.pageCommitted(); }
      return { kind: view.outcome };
    } });
  function advance(ms) {
    const end = now + ms;
    for (;;) { const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > end) break;
      timers.delete(next[0]); now = next[1].at; next[1].fn(); }
    now = end;
  }
  owner.setSessionTimer(0, 0); owner.setSpeed(2); owner.start(); owner.armPageTimer(true);
  return { owner, view, timers, advance };
}

const cases = {
  async 'source-modal-observer'() {
    const { foundationControls } = await import('./lib/reader-foundation-control-probe.mjs');
    const { switchControls } = await import('./lib/reader-switch-control-probe.mjs');
    const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
    const controls = foundationControls(), toggles = switchControls({ properties: controls.properties });
    const source = read('features/source/ui/SourceManagementPage.ets');
    const members = ['inputEnabled', 'projectedSources', 'sourceActions', 'currentSourceRow', 'detectButton', 'loginButton',
      'sourceSwitch', 'sourceSwitchValue', 'sourceSwitchName', 'sourceActionEnabled', 'sourceDetectEnabled', 'sourceActionLabel',
      'sourceToggleBusy', 'sourceRowCommand', 'sourceRowIsCurrent', 'sourceRowToggle', 'sourceRenderKey',
      'managementBackIsCurrent', 'managementOpeningIsCurrent', 'managementInputIsCurrent'];
    const hooks = { ...controls.properties.hooks, ...controls.hooks,
      childSources: { ...controls.hooks.childSources, ...toggles.hooks.childSources }, allowEmptyBranchAdmission: true };
    let modal = false;
    const index = { searchAppForeground: true, arkWebCapturesInput: false,
      jsonImportPresentation: { get opening() { return modal ? {} : undefined; } } };
    const scalar = () => selectedProductionComponentCallback(file('pages/Index.ets'), 'SourceJourneySurface', 'inputEnabled', index);
    const allowed = selectedProductionComponentCallback(file('pages/Index.ets'), 'SourceJourneySurface', 'isInputAllowed', index);
    const Surface = selectedProductionMethods(file('features/source/ui/SourceJourneySurface.ets'), 'SourceJourneySurface', ['managementInputIsCurrent']);
    const surface = new Surface();
    Object.assign(surface, { mounted: true, inputEnabled: true, isInputAllowed: allowed,
      presentation: { isManagementCurrent: () => true } });
    const opening = selectedProductionComponentCallback(file('features/source/ui/SourceJourneySurface.ets'), 'SourceManagementPage', 'isOpeningCurrent', surface);
    const pageAllowed = selectedProductionComponentCallback(file('features/source/ui/SourceJourneySurface.ets'), 'SourceManagementPage', 'isInputAllowed', surface);
    const pageScalar = () => selectedProductionComponentCallback(file('features/source/ui/SourceJourneySurface.ets'), 'SourceManagementPage', 'inputEnabled', surface);
    const probe = createReaderBuilderProbe(source, members, { ...controls.dependencies, ...toggles.dependencies }, hooks);
    const page = probe.owner, actions = [];
    const row = { sourceId: 'source', name: 'Source', enabled: true, loginUrl: 'https://source.test', checkState: 'unchecked' };
    Object.assign(page, { mounted: true, appForeground: true, temporaryBackIdentity: 'opening', groupOpen: false,
      sources: [row], projectedSources: [row], operation: { action: 'load', sourceId: '' }, appThemeScheme: 'day',
      inputEnabled: true, isOpeningCurrent: opening, isInputAllowed: pageAllowed,
      layoutBudget: () => ({ trailingWidth: 120, actionsHeight: 32 }), statusBadge() {}, cancelToolsReturnFocus() {},
      onDetectSource: id => actions.push(['check', id]), onLoginSource: id => actions.push(['login', id]),
      onToggleSource: (id, value) => actions.push(['toggle', id, value]) });
    page.sourceActions(row);
    const actor = spec => [...page.children.values()].reverse().find(child => child.specId === spec);
    const buttons = () => ['source-management-detect', 'source-management-login'].map(spec => controls.nodes(actor(spec)).find(n => n.type === 'Button' && n.onClick));
    const toggle = () => controls.nodes(actor('standard-toggle')).find(n => n.type === 'Toggle' && n.onChange);
    assert.equal(buttons().length, 2); assert.ok(toggle());
    const retained = buttons()[0].onClick;
    modal = true; retained(); assert.deepEqual(actions, [], 'live port rejects before Prop delivery');
    surface.inputEnabled = scalar(); page.updateStateVars({ inputEnabled: pageScalar() }); controls.properties.flush();
    assert.ok(buttons().every(n => n.enabled === false)); assert.equal(toggle().enabled, false);
    // Accepted publication while covered does not restore eligibility.
    const checking = { ...row, checkState: 'checking' };
    page.sources = [checking]; page.projectedSources = [checking]; controls.properties.flush();
    const completed = { ...row, checkState: 'passed' };
    page.sources = [completed]; page.projectedSources = [completed]; controls.properties.flush();
    assert.ok(buttons().every(n => n.enabled === false), 'completed row while covered still disabled');
    modal = false; surface.inputEnabled = scalar(); page.updateStateVars({ inputEnabled: pageScalar() }); controls.properties.flush();
    assert.ok(buttons().every(n => n.enabled === true), 'Prop change alone restores native attributes');
    assert.equal(toggle().enabled, true); assert.equal(toggle().focusable, true);
    retained(); assert.deepEqual(actions, [], 'old row action cannot revive after changed render identity');
    for (const n of buttons()) n.onClick(); toggle().onChange(false);
    assert.deepEqual(actions.slice().sort((a, b) => a[0].localeCompare(b[0])), [['check', 'source'], ['login', 'source'], ['toggle', 'source', false]]);
    page.operation = { original: { blocked: true } };
    assert.equal(page.sourceActionEnabled(), false); assert.equal(page.sourceDetectEnabled('source'), true);
    index.arkWebCapturesInput = true; assert.equal(scalar(), false);
    index.arkWebCapturesInput = false; index.searchAppForeground = false; assert.equal(scalar(), false);
  },

  async 'download-progress-handoff'() {
    const projection = await import('../entry/src/main/ets/features/downloads/presentation/SharedDownloadProjection.ts');
    for (const retire of [false, true]) {
      const book = { sourceId: 's', bookId: 'b', title: 'book', author: '', contentKind: 'novel' };
      const listeners = new Set(), tasks = new Map(), publications = []; let serial = 0, revision = 0, value = 0, hold;
      const blocked = deferred(); let entered = false, loads = 0;
      const owner = { bookAcquisitions: () => ({ readingProjectionRevision: () => 0,
        downloadStatusRevision: () => revision, subscribeDownloadStatus(fn) { listeners.add(fn); return () => listeners.delete(fn); } }),
        mangaStorageSummary: async () => ({}) };
      class Status { async load(row) { loads++; const captured = value;
        if (hold) { hold = false; entered = true; await blocked.promise; }
        return { ...row, projectionStatus: 'ready', downloadedChapters: captured, totalChapters: 10, chapters: [],
          state: 'none', stateLabel: '', progressPercent: captured * 10 }; } }
      // Timer ports are injected into the actual module closure, without changing Host methods.
      const { ts } = installedEtsCompiler();
      const body = ts.transpileModule(read('features/downloads/application/SharedDownloadHost.ts').replace(/^import[\s\S]*?from ['"][^'"]+['"];\n/gm, ''),
        { compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS } }).outputText;
      const exported = {};
      new Function('exports', 'BookshelfFlowGateway', 'SharedDownloadGateway', 'ReaderCoreGateway', 'createDownloadBookView',
        'projectDownloadBookAvailability', 'setTimeout', 'clearTimeout', body)(exported,
        class { async loadAll() { return { books: [book] }; } }, Status, class {}, projection.createDownloadBookView,
        projection.projectDownloadBookAvailability, fn => { const id = ++serial; tasks.set(id, fn); return id; }, id => tasks.delete(id));
      const host = new exported.SharedDownloadHost(owner, snapshot => publications.push(snapshot));
      const flush = async () => { const work = [...tasks.values()]; tasks.clear(); work.forEach(fn => fn()); await drain(); };
      const notify = n => { value = n; revision++; for (const fn of listeners) fn({ identities: [book] }); };
      await host.reload(() => true);
      hold = true; notify(1); await flush(); assert.equal(entered, true);
      value = 2; revision++; await host.reload(() => true);
      assert.equal(publications.at(-1).books[0].downloadedChapters, 2);
      notify(3); assert.equal(tasks.size, 0, 'old progress read holds its lane');
      const before = publications.length;
      if (retire) host.retire();
      blocked.resolve(); await drain();
      if (retire) { assert.equal(tasks.size, 0); assert.equal(publications.length, before); assert.equal(listeners.size, 0); }
      else { assert.equal(publications.length, before, 'old value cannot overwrite current generation');
        assert.equal(tasks.size, 1); await flush();
        assert.equal(publications.at(-1).books[0].downloadedChapters, 3, 'final notification needs no extra event');
        assert.equal(tasks.size, 0); host.retire(); }
      assert.ok(loads >= 3);
    }
  },

  async 'bookshelf-current-group'() {
    const path = file('features/bookshelf/ui/BookshelfPage.ets');
    const Page = selectedProductionMethods(path, 'BookshelfPage', ['bookActionPresentationHandler', 'bookActionFocusKey',
      'isShelfPresentationCurrent', 'presentBookActionSheet', 'isCurrentBookActionSheet', 'performBookAction', 'finishBookActionSheet', 'bookRowRenderKey']);
    for (const listMore of [false, true]) {
      const old = { sourceId: 's', bookId: 'b', title: 'book', author: '', group: 'old' }, fresh = { ...old, group: '' };
      const page = new Page(), requests = [];
      Object.assign(page, { mounted: true, navigationGeneration: 2, books: [old], actionSheetRevision: 0,
        isCurrentShelfInput: () => true, isCurrentChromeHost: () => true, restoreBookActionFocus() {},
        onBookGroupRequested: (book, navigation) => requests.push([book.group, navigation]) });
      const action = page.bookActionPresentationHandler(old, listMore);
      assert.equal(page.bookRowRenderKey([old], 0), page.bookRowRenderKey([fresh], 0));
      page.books = [fresh]; action(); assert.equal(page.actionBook, fresh);
      const presentationId = page.actionSheetId, book = page.actionBook;
      const edit = selectedProductionComponentCallback(path, 'BookshelfBookActionSheet', 'onEditGroup', page, { presentationId, book });
      edit(); assert.deepEqual(requests, [], 'dispatch waits for sheet disappearance');
      page.finishBookActionSheet(presentationId, book); assert.deepEqual(requests, [['', 2]]);
      page.books = [{ ...fresh, sourceId: 'other' }]; action(); assert.equal(page.actionBook, undefined);
      page.books = [fresh]; page.navigationGeneration++; action(); assert.equal(page.actionBook, undefined);
    }
  },

  async 'bookshelf-batch-notify'() {
    const path = file('features/bookshelf/ui/BookshelfPage.ets');
    const Page = selectedProductionMethods(path, 'BookshelfPage', ['bookRowRenderKey']), page = new Page();
    // Finite platform enum port; SDK compilation separately checks its API.
    const DataOperationType = { ADD: 'add', DELETE: 'delete', RELOAD: 'reload' };
    const { BookshelfRowDataSource } = selectedProductionClasses(path, ['BookshelfRowDataSource'], { DataOperationType });
    const ds = new BookshelfRowDataSource(row => page.bookRowRenderKey(row, 0)), notices = [];
    ds.registerDataChangeListener({ ...Object.fromEntries(['onDataAdd', 'onDataDelete', 'onDataChange', 'onDataMove', 'onDataChanged', 'onDataMoved'].map(name => [name, () => assert.fail('mixed legacy '+name)])), onDataReloaded() { assert.fail('legacy notify cannot mix with batch'); },
      onDataAdded() { assert.fail('legacy add'); }, onDataDeleted() { assert.fail('legacy delete'); },
      onDatasetChange(ops) { notices.push(ops); for (let i = 0; i < ds.totalCount(); i++) {
        const row = ds.getData(i); assert.ok(row); assert.equal(ds.positionForKey(page.bookRowRenderKey(row, 0), -1)(), i); } } });
    const rows = Array.from({ length: 144 }, (_, i) => [{ sourceId: 's', bookId: String(i), title: String(i), author: '' }]);
    const replace = expected => { ds.replace(expected); assert.equal(ds.totalCount(), expected.length); assert.deepEqual(Array.from({length:ds.totalCount()},(_,i)=>ds.getData(i).map(b=>[b.sourceId,b.bookId,b.group])), expected.map(row=>row.map(b=>[b.sourceId,b.bookId,b.group]))); };
    replace(rows.slice(0, 48)); replace(rows.slice(0, 96)); replace(rows);
    assert.deepEqual(notices.map(n => n[0].key), [rows.slice(0,48),rows.slice(48,96),rows.slice(96)].map(part => part.map(row=>page.bookRowRenderKey(row,0))));
    assert.deepEqual(notices.map(n => { const { type, index, count } = n[0]; return { type, index, count }; }), [0, 48, 96].map(index => ({ type: DataOperationType.ADD, index, count: 48 })));
    notices.length = 0; replace(rows.map(row => [{ ...row[0], group: 'fresh' }]));
    assert.deepEqual(notices, []); assert.equal(ds.getData(0)[0].group, 'fresh');
    replace(rows.slice(0, 96)); assert.deepEqual(notices.pop(), [{ type: DataOperationType.DELETE, index: 96, count: 48 }]);
    replace(rows.slice(48)); assert.deepEqual(notices.pop(), [{ type: DataOperationType.RELOAD }]);
    replace([...rows.slice(48)].reverse()); assert.deepEqual(notices.pop(), [{ type: DataOperationType.RELOAD }]);
    replace([]); assert.deepEqual(notices.pop(), [{ type: DataOperationType.DELETE, index: 0, count: 96 }]);
  },

  async 'autopage-paused-pending'() {
    for (const outcome of ['preparing', 'busy']) for (const sync of [false, true]) {
      const f = autoFixture(sync); f.view.outcome = outcome; f.advance(2000); assert.equal(f.view.turns, 1);
      f.owner.pause('touch'); f.owner.resumePendingTurn(); assert.equal(f.view.turns, 1);
      f.owner.resume(); f.view.outcome = 'started'; f.view.active = false; f.owner.resumePendingTurn(); assert.equal(f.view.turns, 1);
      f.view.active = true; f.view.ready = false; f.owner.resumePendingTurn(); assert.equal(f.view.turns, 1);
      f.view.ready = true; f.owner.armPageTimer(true); assert.equal(f.view.turns, 2);
      f.owner.resumePendingTurn(); assert.equal(f.view.turns, 2);
      if (sync) { assert.equal(f.timers.size, 1, 'synchronous ACK keeps exactly one next deadline'); f.advance(2000); assert.equal(f.view.turns, 3); }
      else { assert.equal(f.owner.snapshot().awaitingPageCommit, true); f.advance(10000); assert.equal(f.view.turns, 2);
        f.owner.pause('touch'); f.owner.pageCommitted(); assert.equal(f.owner.snapshot().status, 'paused'); assert.equal(f.owner.snapshot().awaitingPageCommit, false); assert.equal(f.owner.snapshot().remainingSeconds, 2); }
      f.owner.stop(); f.owner.resumePendingTurn(); assert.equal(f.timers.size, 0);
      f.owner.dispose(); assert.equal(f.timers.size, 0);
    }
  },

  async 'autopage-window-unlock'() {
    const LRE = selectedProductionMethods(file('features/reading/ui/LocalReadingExperience.ets'), 'ReadingExperience', ['commitReaderWindowSettings', 'captureReaderSettingsAdmission', 'isSessionActive', 'isMountedToken']);
    for (const result of ['success', 'failure', 'new-window', 'new-preference', 'inactive']) {
      const f = autoFixture(); f.advance(2000); f.view.resumable = false;
      const window = deferred(), save = deferred(), page = new LRE(); let wakes = 0;
      Object.assign(page, { mounted: true, lifecycleToken: 7, readerSettingsMutationGeneration: 1, readerWindowPolicyGeneration: 0,
        readerSettingsSnapshot: { screenTimeout: 1 }, pageTurnRenderRevision: 0,
        pageTurnInputPhase: () => 'idle', configureReaderScreenAwakeLease() {}, applyReaderSystemEventPolicy() {},
        sourceId: 's', bookId: 'b', exitRequested: false, controlsPresentedForWindow: () => false,
        applyReaderWindowPolicy: () => window.promise, persistReaderSettingsSnapshot: () => save.promise,
        notifyReaderSettingsSavePending() {}, reflowAfterWindowGeometryChange() { assert.fail('timeout does not reflow'); },
        showReaderSettingsFailure() {}, resumePendingAutoPageTurn() { wakes++; f.view.resumable = !this.readerWindowPolicyPending; f.owner.resumePendingTurn(); } });
      if (result === 'inactive') f.view.active = false;
      page.commitReaderWindowSettings({ screenTimeout: 2 }); assert.equal(page.readerWindowPolicyPending, true);
      f.view.outcome = 'started';
      if (result === 'new-window') { page.readerWindowPolicyGeneration++; page.readerSettingsMutationGeneration++; }
      if (result === 'new-preference') page.readerSettingsMutationGeneration++;
      if (result === 'failure') { page.applyReaderWindowPolicy = async () => {}; window.resolve(Promise.reject(Error('native failure'))); }
      else window.resolve();
      await drain();
      if (result === 'new-window') { assert.equal(page.readerWindowPolicyPending, true); assert.equal(wakes, 0); }
      else { assert.equal(page.readerWindowPolicyPending, false); assert.equal(f.view.turns, result === 'inactive' ? 1 : 2); }
      save.resolve(); await drain(); assert.ok(f.view.turns <= 2, 'finally cannot duplicate an admitted turn'); f.owner.dispose();
    }
    const session = await import('../entry/src/main/ets/features/reading/ui/ReaderControlSessionState.ts');
    const hostSession = await import('../entry/src/main/ets/features/reading/ui/ReaderControlHostSession.ts');
    const Controls = selectedProductionMethods(file('features/reading/ui/LocalReadingExperience.ets'), 'ReadingExperience',
      ['onControlSessionChanged', 'controlVisible', 'controlPage'], { ...session, ...hostSession,
        ReaderWindowCoordinator: { metrics: () => ({}) }, readerControlKeyboardVisible: () => false });
    for (const exitRequested of [false, true]) {
      const f=autoFixture();f.advance(2000);f.owner.pause('touch');f.owner.resume();f.view.outcome='started';
      const page=new Controls();let wakes=0;
      const opened=session.openReaderControlSession(session.createReaderControlSessionState(),0);
      const closed=session.dismissReaderControlSession(opened,0);
      Object.assign(page,{controlSession:closed,observedControlCloseRevision:0,observedControlPage:'home',observedControlModule:'home',
        mounted:true,exitRequested,replacePanelGeneration:0,quickSearchQuery:'old',
        quickSearchPublication:{cancel(){}},admitSessionControlClosing(){},applyWindowPolicyForChromeOwner(){},
        invalidateControlBackdrop(){},dismissControlTemporaryLayers(){},publishQuickSearchState(){},drainPageTurnPreparationQueue(){},
        resumePendingAutoPageTurn(){wakes++;f.owner.resumePendingTurn();}});
      page.onControlSessionChanged();
      assert.equal(page.observedControlCloseRevision,closed.closeRevision);
      assert.equal(wakes,exitRequested?0:1);assert.equal(f.view.turns,exitRequested?1:2);
      page.onControlSessionChanged();assert.equal(wakes,exitRequested?0:1,'same close commit cannot wake twice');f.owner.dispose();
    }

  },
};

for (const id of selectContractCases(definitions)) { await cases[id](); recordContractCasePass(id); }
