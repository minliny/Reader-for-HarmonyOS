import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={"toggle-focus-availability": {"description": "Actual SDK availability watchers resume current pending keyboard and reader focus after a busy mount or blocked frame and reject retired owners", "resources": []},"toggle-focus-buffer": {"description": "Explicit DEBUG buffered focus diagnostics perform no callback-time logging, bound the buffer and flush only through the actual warm-Want entry", "resources": []},"toggle-accessibility-ack": {"description": "Actual SDK Toggle retries an unacknowledged accessibility replacement once and retires the retry on focus, identity, foreground and operation changes", "resources": []},"toggle-native-focus-target": {"description": "Actual native target IDs bind the remount revision, old queued accessibility requests cannot address successors, logging defaults off", "resources": []},"toggle-focus-identity": {"description": "Focus ownership and pending continuations retire with input identity, including late callbacks at the same native revision", "resources": []},"toggle-accessibility-focus": {"description": "Actual native accessibility focus callback and current-revision not-interrupt restoration with retirement and foreground negatives", "resources": []},"toggle-focus": {"description": "Actual keyed Toggle restores only its prior keyboard focus once after remount and rejects stale or disabled deferred requests", "resources": []},"toggle": {"description": "实际受控Toggle接纳、identity/disabled/busy/retired与四guard负例", "resources": []}, "segment": {"description": "实际enum稳定optionID重排/删除/重复及受控选择", "resources": []}, "press": {"description": "当前共享按压/取消恢复与禁用不请求pressed fill", "resources": []}, "spec-propagation": {"description": "当前有限spec宽度+3传播与另一族隔离/private拒绝", "resources": []}, "source": {"description": "SourceManagement当前Toggle控制与blocked原操作", "resources": []}, "settings": {"description": "Settings受控回执/unknown/pending/旧页面拒绝", "resources": []}, "rules": {"description": "Rules本地boolean草稿在未决保存期间可编辑", "resources": []}, "rss-management": {"description": "RSS当前立即写回执与旧presentation拒绝", "resources": []}, "rss-editor": {"description": "RSS实际build两个本地草稿Toggle与旧editor拒绝", "resources": []}, "theme": {"description": "Settings实际ThemeHost接受后shared enum更新", "resources": []}, "lazy-theme": {"description": "Root按需真实shared enum解析与保留child更新", "resources": []}};
definitions['source-row-value'] = { description: 'Actual Source row identity retains accepted value/version updates and SDK child consumes current projection while old snapshot and removed source callbacks retire', resources: [] };
for(const id of selectContractCases(definitions)){await runSelectedCase(id);recordContractCasePass(id);}
async function runSelectedCase(selectedCase){
const { resolveEtsLoaderRoot, virtualFilePath } = await import('./lib/tool-environment.mjs');
const {default: assert} = await import('node:assert/strict');
const {readFileSync} = await import('node:fs');
const {createRequire} = await import('node:module');
const {switchControls,switchSpecs,toggleSource,segmentSource,switchSpecSource:specSource} = await import('./lib/reader-switch-control-probe.mjs');
const {createReaderBuilderProbe} = await import('./lib/reader-control-builder-probe.mjs');
const {boundedMembers} = await import('./lib/bounded-surface-sdk-probe.mjs');
const {readerFoundationTokens} = await import('./lib/reader-foundation-control-probe.mjs');
const {readerAppColor} = await import('../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts');

const liveSourcePaths = new Map([
 ['entry/src/main/ets/features/source/SourceManagementPage.ets', 'entry/src/main/ets/features/source/ui/SourceManagementPage.ets'],
 ['entry/src/main/ets/features/settings/SettingsPage.ets', 'entry/src/main/ets/features/settings/ui/SettingsPage.ets'],
 ['entry/src/main/ets/features/settings/RulesManagementPage.ets', 'entry/src/main/ets/features/settings/ui/RulesManagementPage.ets'],
]);
const read=p=>readFileSync(new URL('../'+(liveSourcePaths.get(p)??p),import.meta.url),'utf8');
const nativeToggle=(p,o)=>p.nodes(o).findLast(n=>n.type==='Toggle'&&n.onChange);
const nativeChoice=(p,o)=>p.choices(o);
let cases=0;
if (selectedCase === 'toggle-focus-availability') {
  const exercise = (phase, input, stop = 'ready', definition = toggleSource) => {
    const frames = [], events = [], keyboard = [];
    const p = switchControls({ toggleDefinition: definition,
      accessibility: { sendAccessibilityEvent: async event => events.push(event) } });
    const owner = p.mount(p.toggle, { inputIdentity: 'available-A', value: false, onToggle() {} });
    owner.getUIContext = () => ({ postFrameCallback: frame => frames.push(frame),
      getHostContext: () => ({ applicationInfo: { name: 'io.reader.minliny' } }),
      getFocusController: () => ({ requestFocus: id => keyboard.push(id) }) });
    try {
      const previous = nativeToggle(p, owner);
      if (input === 'keyboard') previous.onFocus();
      else previous.onAccessibilityFocus(true);
      previous.onChange(true);
      p.properties.flush();
      const current = nativeToggle(p, owner);
      if (phase !== 'mount') current.onAppear();
      if (phase === 'accessibility-frame') frames.shift().onFrame(1000000);
      owner.actionEnabled = false;
      owner.isBusy = true;
      p.properties.flush();
      if (phase === 'mount') current.onAppear();
      else frames.shift().onFrame(1000000);
      assert.equal(frames.length, 0);
      assert.deepEqual(events, []);
      assert.deepEqual(keyboard, []);
      if (stop === 'identity') p.update(owner, { inputIdentity: 'available-B' });
      if (stop === 'background') { owner.appForeground = false; owner.onForegroundChanged(); }
      if (stop === 'retired') owner.aboutToDisappear();
      if (stop !== 'disabled') {
        owner.actionEnabled = true;
        owner.isBusy = false;
        p.properties.flush();
      }
      for (let step = 0; step < 3 && frames.length > 0; step += 1) {
        frames.shift().onFrame(1000000);
        if (keyboard.length) nativeToggle(p, owner).onFocus();
        if (events.length) nativeToggle(p, owner).onAccessibilityFocus(true);
      }
      assert.equal(frames.length, 0, 'resumption is bounded');
      assert.equal(keyboard.length, stop === 'ready' && input === 'keyboard' ? 1 : 0);
      assert.equal(events.length, stop === 'ready' && input === 'reader' ? 1 : 0, 'current reader focus resumes when availability returns');
    } finally { owner.aboutToDisappear(); }
  };
  for (const input of ['keyboard', 'reader']) {
    for (const phase of input === 'reader' ? ['mount', 'first-frame', 'accessibility-frame'] : ['mount', 'first-frame']) {
      exercise(phase, input);
    }
  }
  for (const stop of ['identity', 'background', 'retired', 'disabled']) exercise('mount', 'reader', stop);
  const mixedFrames = [], mixedEvents = [], mixedKeyboard = [];
  const mixed = switchControls({ accessibility: { sendAccessibilityEvent: async event => mixedEvents.push(event) } });
  const mixedOwner = mixed.mount(mixed.toggle, { inputIdentity: 'mixed-busy-A', value: false, onToggle() {} });
  mixedOwner.getUIContext = () => ({ postFrameCallback: frame => mixedFrames.push(frame),
    getHostContext: () => ({ applicationInfo: { name: 'io.reader.minliny' } }),
    getFocusController: () => ({ requestFocus: id => mixedKeyboard.push(id) }) });
  const oldMixed = nativeToggle(mixed, mixedOwner);
  oldMixed.onFocus(); oldMixed.onAccessibilityFocus(true); oldMixed.onChange(true);
  mixed.properties.flush();
  const newMixed = nativeToggle(mixed, mixedOwner);
  newMixed.onAppear(); mixedFrames.shift().onFrame(1000000);
  assert.equal(mixedKeyboard.length, 1);
  mixedOwner.actionEnabled = false; mixedOwner.isBusy = true; mixed.properties.flush();
  newMixed.onFocus(); newMixed.onBlur();
  assert.equal(mixedFrames.length, 0, 'keyboard acknowledgement while busy cannot request accessibility focus');
  assert.equal(mixedOwner.pendingAccessibilityFocusRevision, 1);
  mixedOwner.actionEnabled = true; mixedOwner.isBusy = false; mixed.properties.flush();
  mixedFrames.shift().onFrame(1000000); mixedFrames.shift().onFrame(1000000);
  assert.equal(mixedEvents.length, 1, 'pending reader continuation resumes after the busy keyboard acknowledgement');
  newMixed.onAccessibilityFocus(true); mixedFrames.shift().onFrame(1000000);
  assert.equal(mixedKeyboard.length, 2, 'the original mixed-input intent survives an accessibility-only resumed phase');
  mixedOwner.aboutToDisappear();
  const lateMixed = (phase, stop = 'ready', definition = toggleSource) => {
    const frames = [], events = [], keyboard = [];
    const p = switchControls({ toggleDefinition: definition,
      accessibility: { sendAccessibilityEvent: async event => events.push(event) } });
    const owner = p.mount(p.toggle, { inputIdentity: 'late-mixed-A', value: false, onToggle() {} });
    owner.getUIContext = () => ({ postFrameCallback: frame => frames.push(frame),
      getHostContext: () => ({ applicationInfo: { name: 'io.reader.minliny' } }),
      getFocusController: () => ({ requestFocus: id => keyboard.push(id) }) });
    try {
      const previous = nativeToggle(p, owner);
      previous.onFocus(); previous.onAccessibilityFocus(true); previous.onChange(true);
      p.properties.flush();
      const current = nativeToggle(p, owner);
      current.onAppear(); frames.shift().onFrame(1000000);
      current.onFocus(); frames.shift().onFrame(1000000);
      if (phase === 'keyboard-frame') current.onAccessibilityFocus(true);
      owner.isBusy = true; p.properties.flush();
      current.onBlur();
      if (phase === 'keyboard-frame') frames.shift().onFrame(1000000);
      else current.onAccessibilityFocus(true);
      assert.equal(keyboard.length, 1, 'blocked final mixed phase cannot request keyboard focus');
      if (stop === 'identity') p.update(owner, { inputIdentity: 'late-mixed-B' });
      if (stop === 'background') { owner.appForeground = false; owner.onForegroundChanged(); }
      if (stop === 'retired') owner.aboutToDisappear();
      if (stop !== 'disabled') { owner.isBusy = false; p.properties.flush(); }
      for (let step = 0; step < 3 && frames.length; step += 1) frames.shift().onFrame(1000000);
      assert.equal(frames.length, 0, 'late mixed resumption is bounded');
      assert.equal(keyboard.length, stop === 'ready' ? 2 : 1,
        'current mixed keyboard intent survives busy after actual accessibility ACK');
      assert.equal(events.length, 1, 'already acknowledged accessibility focus is not replayed');
    } finally { owner.aboutToDisappear(); }
  };
  for (const phase of ['keyboard-frame', 'accessibility-ack']) {
    for (const stop of ['ready', 'identity', 'background', 'retired', 'disabled']) lateMixed(phase, stop);
  }
  const lostLateKeyboard = toggleSource.replace('      this.pendingFocusRevision = revision;\n      this.restoringRevision = -1;',
    '      return;');
  assert.notEqual(lostLateKeyboard, toggleSource);
  assert.throws(() => lateMixed('keyboard-frame', 'ready', lostLateKeyboard), /current mixed keyboard intent survives/);
  const lostLateAck = toggleSource.replace('    this.continueKeyboardAfterAccessibility(this.inputIdentity, this.nativeRevision);', '');
  assert.notEqual(lostLateAck, toggleSource);
  assert.throws(() => lateMixed('accessibility-ack', 'ready', lostLateAck), /current mixed keyboard intent survives/);
  for (const stop of ['ready', 'identity', 'background', 'retired', 'disabled']) {
    const frames = [], events = [], keyboard = [];
    let accept;
    const accepted = new Promise(resolve => { accept = resolve; });
    const p = switchControls({ accessibility: { sendAccessibilityEvent: event => {
      events.push(event); return events.length === 1 ? accepted : Promise.resolve();
    } } });
    const owner = p.mount(p.toggle, { inputIdentity: 'settling-reader-A', value: false, onToggle() {} });
    owner.getUIContext = () => ({ postFrameCallback: frame => frames.push(frame),
      getHostContext: () => ({ applicationInfo: { name: 'io.reader.minliny' } }),
      getFocusController: () => ({ requestFocus: id => keyboard.push(id) }) });
    try {
      nativeToggle(p, owner).onAccessibilityFocus(true);
      nativeToggle(p, owner).onChange(true); p.properties.flush();
      const current = nativeToggle(p, owner);
      current.onAppear(); frames.shift().onFrame(1000000); frames.shift().onFrame(1000000);
      owner.isBusy = true; p.properties.flush();
      accept();
      for (let step = 0; step < 6; step += 1) await Promise.resolve();
      assert.equal(owner.pendingAccessibilityFocusRevision, 1,
        'unacknowledged current request settling while busy retains its reader intent');
      if (stop === 'identity') p.update(owner, { inputIdentity: 'settling-reader-B' });
      if (stop === 'background') { owner.appForeground = false; owner.onForegroundChanged(); }
      if (stop === 'retired') owner.aboutToDisappear();
      if (stop !== 'disabled') { owner.isBusy = false; p.properties.flush(); }
      for (let step = 0; step < 3 && frames.length; step += 1) frames.shift().onFrame(1000000);
      assert.equal(frames.length, 0);
      assert.equal(events.length, stop === 'ready' ? 2 : 1, 'only current available reader intent resumes');
      assert.deepEqual(keyboard, [], 'pure reader resumption does not acquire keyboard focus');
      if (stop === 'ready') nativeToggle(p, owner).onAccessibilityFocus(true);
    } finally { owner.aboutToDisappear(); }
  }
  const lostAvailability = toggleSource.replace('this.restoreNativeFocus(this.inputIdentity, this.nativeRevision);',
    'return;');
  assert.notEqual(lostAvailability, toggleSource);
  assert.throws(() => exercise('mount', 'reader', 'ready', lostAvailability), /current reader focus resumes when availability returns/);
}
if (selectedCase === 'toggle-focus-buffer') {
  const buffer = [], diagnostics = [];
  for (const identity of ['buffer-A', 'buffer-B']) {
    const p = switchControls({ debug: true, focusTrace: 'buffered', focusBuffer: buffer, diagnostics });
    const owner = p.mount(p.toggle, { inputIdentity: identity, accessibilityLabel: identity });
    for (let index = 0; index < 70; index += 1) owner.diagnosticFocus('buffer-' + index, 0);
    assert.equal(owner.diagnosticFocusEvents, 64);
    owner.aboutToDisappear();
  }
  assert.equal(buffer.length, 64);
  assert.deepEqual(diagnostics, [], 'buffered callbacks perform no hilog IO');
  assert.equal(JSON.parse(buffer.at(-1)).stage, 'buffer-63', 'buffered owner and global bounds hold');
  const entry = readFileSync(new URL('../entry/src/main/ets/entryability/EntryAbility.ets', import.meta.url), 'utf8');
  const { ts, options } = (await import('./lib/ets-compiler-runtime.mjs')).installedEtsCompiler();
  const tree = ts.createSourceFile('EntryAbility.ets', entry, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  const declaration = tree.statements.find(node => node.name?.getText(tree) === 'EntryAbility');
  const method = declaration.members.find(node => node.name?.getText(tree) === 'onNewWant').getText(tree);
  const { stripTypeScriptTypes } = await import('node:module');
  for (const [debug, mode] of [[false, 'debug'], [true, 'release'], [true, 'debug']]) {
    const storage = new Map([['readerToggleFocusBuffer', [...buffer]]]), logs = [], received = [];
    const Owner = new Function('DEBUG', 'BUILD_MODE_NAME', 'AppStorage', 'hilog', 'DOMAIN', 'ReaderSystemFileOpenHost',
      stripTypeScriptTypes('class Owner {' + method + '}') + ';return Owner;')(
      debug, mode, { get: key => storage.get(key), setOrCreate: (key, value) => storage.set(key, value) },
      { info: (...args) => logs.push(args) }, 0x5244, { receive: want => received.push(want) });
    const owner = new Owner();
    owner.frameworkCapture = { start() {} };
    owner.context = { cacheDir: '/finite-cache' };
    const want = { parameters: { readerToggleFocusTrace: 'flush' } };
    owner.onNewWant(want, {});
    assert.deepEqual(received, [want], 'normal warm-Want reception remains active');
    assert.equal(logs.length, debug && mode === 'debug' ? 64 : 0);
    if (debug && mode === 'debug') {
      assert.equal(storage.get('readerToggleFocusTrace'), false);
      assert.deepEqual(storage.get('readerToggleFocusBuffer'), []);
      owner.onNewWant({ parameters: { readerToggleFocusTrace: 'buffered' } }, {});
      assert.equal(storage.get('readerToggleFocusTrace'), 'buffered');
      assert.deepEqual(storage.get('readerToggleFocusBuffer'), []);
      owner.onNewWant({ parameters: { readerToggleFocusTrace: false } }, {});
      assert.equal(storage.get('readerToggleFocusTrace'), false);
    }
  }
}
if (selectedCase === 'toggle-accessibility-ack') {
  const { mock } = await import('node:test');
  const settle = async () => {
    for (let index = 0; index < 5; index += 1) await Promise.resolve();
  };
  const exercise = async (stop, definition = toggleSource) => {
    mock.timers.enable({ apis: ['setTimeout'] });
    let owner;
    try {
      const frames = [], events = [], keyboard = [];
      const p = switchControls({ toggleDefinition: definition,
        accessibility: { sendAccessibilityEvent: async event => {
          events.push(event);
          if (stop === 'rejected') throw new Error('replacement not on accessibility tree');
        } } });
      owner = p.mount(p.toggle, { inputIdentity: 'ack-A', value: false, onToggle() {} });
      owner.getUIContext = () => ({ postFrameCallback: frame => frames.push(frame),
        getHostContext: () => ({ applicationInfo: { name: 'io.reader.minliny' } }),
        getFocusController: () => ({ requestFocus: id => keyboard.push(id) }) });
      const previous = nativeToggle(p, owner);
      previous.onAccessibilityFocus(true);
      previous.onChange(true);
      p.properties.flush();
      const current = nativeToggle(p, owner);
      current.onAppear();
      frames.shift().onFrame(1000000);
      frames.shift().onFrame(1000000);
      await settle();
      assert.equal(events.length, 1, 'first actual request dispatched');
      if (stop === 'ack') current.onAccessibilityFocus(true);
      if (stop === 'moved') { current.onAccessibilityFocus(true); current.onAccessibilityFocus(false); }
      if (stop === 'identity') p.update(owner, { inputIdentity: 'ack-B' });
      if (stop === 'disabled') p.update(owner, { actionEnabled: false });
      if (stop === 'busy') p.update(owner, { isBusy: true });
      if (stop === 'retired') owner.aboutToDisappear();
      if (stop === 'background') { owner.appForeground = false; owner.onForegroundChanged(); }
      if (stop === 'new-revision') current.onChange(true);
      mock.timers.tick(99);
      assert.equal(events.length, 1, 'no immediate focus loop');
      mock.timers.tick(1);
      await settle();
      const shouldRetry = ['none', 'rejected'].includes(stop);
      assert.equal(events.length, shouldRetry ? 2 : 1, 'only the unacknowledged current replacement retries');
      assert.ok(events.every(event => event.customId === 'reader-toggle:ack-A:1'));
      mock.timers.tick(1000);
      await settle();
      assert.equal(events.length, shouldRetry ? 2 : 1, 'one retry is the complete bound');
      if (stop === 'busy' || stop === 'disabled') {
        p.update(owner, { actionEnabled: true, isBusy: false });
        for (let step = 0; step < 3 && frames.length; step += 1) frames.shift().onFrame(1000000);
        await settle();
        assert.equal(events.length, 2, 'a retry blocked by temporary ' + stop + ' retains its current reader intent ' + JSON.stringify({ pending: owner.pendingAccessibilityFocusRevision, restoring: owner.restoringRevision, reader: owner.accessibilityFocusedRevision, busy: owner.isBusy, enabled: owner.actionEnabled }));
        nativeToggle(p, owner).onAccessibilityFocus(true);
        mock.timers.tick(1000); await settle();
        assert.equal(events.length, 2, 'actual reader acknowledgement ends the resumed retry');
      }
      assert.deepEqual(keyboard, [], 'reader-only continuation retains keyboard-unfocused state');
    } finally {
      owner?.aboutToDisappear();
      mock.timers.reset();
    }
  };
  for (const stop of ['none', 'rejected', 'ack', 'moved', 'identity', 'disabled', 'busy', 'retired', 'background', 'new-revision']) {
    await exercise(stop);
  }
  const oneShot = toggleSource.replace('if (!allowRetry) return;', 'return;');
  assert.notEqual(oneShot, toggleSource);
  await assert.rejects(exercise('none', oneShot), /only the unacknowledged current replacement retries/);
}
if(selectedCase==='toggle'){
 const p=switchControls(),calls=[],o=p.mount(p.toggle,{inputIdentity:'A',value:false,onToggle:next=>calls.push(next)}),old=nativeToggle(p,o),oldChange=old.onChange;
 oldChange(true);p.properties.flush();assert.deepEqual(calls,[true]);assert.equal(o.value,false,'intent never changes controlled value');
 assert.equal(nativeToggle(p,o).create.isOn,false,'native control is refreshed from the owner');
 p.update(o,{value:true});oldChange(false);assert.deepEqual(calls,[true],'retired native event is rejected');
 nativeToggle(p,o).onChange(false);assert.deepEqual(calls,[true,false]);
 p.update(o,{value:false});assert.equal(nativeToggle(p,o).create.isOn,false,'checked state follows owner');
 p.update(o,{actionEnabled:false});nativeToggle(p,o).onChange(true);assert.equal(calls.length,2);
 p.update(o,{actionEnabled:true,isBusy:true});const busy=nativeToggle(p,o);busy.onChange(true);assert.equal(calls.length,2);
 p.update(o,{isBusy:false,inputIdentity:'B'});busy.onChange(true);assert.equal(calls.length,2,'old physical identity rejected');
 const fresh=nativeToggle(p,o);fresh.onChange(true);assert.equal(calls.length,3);
 o.aboutToDisappear();fresh.onChange(true);assert.equal(calls.length,3);cases++;
}
if (selectedCase === 'toggle-focus') {
  for (const stop of ['none', 'identity', 'disabled', 'busy', 'retired', 'request', 'background']) {
    const p = switchControls(), frames = [], requests = [], intents = [];
    const o = p.mount(p.toggle, { inputIdentity: 'focus-A', value: false, onToggle: value => intents.push(value) });
    o.getUIContext = () => ({ postFrameCallback: frame => frames.push(frame),
      getFocusController: () => ({ requestFocus: id => requests.push(id) }) });
    const initial = nativeToggle(p, o);
    initial.onFocus(); initial.onChange(true); p.properties.flush();
    assert.deepEqual(intents, [true]);
    assert.equal(nativeToggle(p, o).create.isOn, false, 'rejected intent keeps accepted owner projection');
    const current = nativeToggle(p, o);
    current.onAppear(); current.onAppear();
    assert.equal(frames.length, 1, 'only one bounded restoration is scheduled for the replacement');
    if (stop === 'identity') p.update(o, { inputIdentity: 'focus-B' });
    if (stop === 'disabled') p.update(o, { actionEnabled: false });
    if (stop === 'busy') p.update(o, { isBusy: true });
    if (stop === 'retired') o.aboutToDisappear();
    if (stop === 'background') o.appForeground = false;
    if (stop === 'request') {
      current.onFocus(); current.onChange(true); p.properties.flush();
    }
    frames[0].onFrame(1000000);
    assert.deepEqual(requests, stop === 'none' ? ['reader-toggle:focus-A:1'] : [], 'only the current eligible native owner can regain focus');
  }
  const p = switchControls(), o = p.mount(p.toggle, { inputIdentity: 'touch', onToggle() {} });
  o.getUIContext = () => { throw Error('unfocused touch must not schedule focus'); };
  nativeToggle(p, o).onChange(true); p.properties.flush(); nativeToggle(p, o).onAppear();
}
if (selectedCase === 'toggle-accessibility-focus') {
  for (const stop of ['none', 'unfocused', 'identity', 'disabled', 'busy', 'retired', 'background', 'new-focus', 'late-event', 'new-request', 'initial-false']) {
    const frames = [], events = [], keyboard = [];
    const p = switchControls({ accessibility: { sendAccessibilityEvent: async event => { events.push(event); } } });
    const o = p.mount(p.toggle, { inputIdentity: 'a11y-A', value: false, onToggle() {} });
    o.getUIContext = () => ({ postFrameCallback: frame => frames.push(frame),
      getHostContext: () => ({ applicationInfo: { name: 'io.reader.minliny' } }),
      getFocusController: () => ({ requestFocus: id => keyboard.push(id) }) });
    const initial = nativeToggle(p, o);
    assert.equal(typeof initial.onAccessibilityFocus, 'function', 'actual SDK native callback');
    if (stop !== 'unfocused') initial.onAccessibilityFocus(true);
    initial.onChange(true); p.properties.flush();
    const current = nativeToggle(p, o);
    current.onAppear(); current.onAppear();
    assert.equal(frames.length, stop === 'unfocused' ? 0 : 1);
    if (stop === 'identity') p.update(o, { inputIdentity: 'a11y-B' });
    if (stop === 'disabled') p.update(o, { actionEnabled: false });
    if (stop === 'busy') p.update(o, { isBusy: true });
    if (stop === 'retired') o.aboutToDisappear();
    if (stop === 'background') o.appForeground = false;
    if (stop === 'new-focus') { current.onAccessibilityFocus(true); current.onAccessibilityFocus(false); }
    if (stop === 'initial-false') current.onAccessibilityFocus(false);
    if (stop === 'late-event') initial.onAccessibilityFocus(false);
    if (stop === 'new-request') { current.onChange(true); p.properties.flush(); }
    frames.shift()?.onFrame(1000000);
    frames.shift()?.onFrame(1000000);
    assert.deepEqual(keyboard, [], 'accessibility focus alone never requests keyboard focus');
    assert.deepEqual(events, ['none', 'late-event', 'initial-false'].includes(stop) ? [{
      type: 'requestFocusForAccessibilityNotInterrupt', bundleName: 'io.reader.minliny',
      triggerAction: 'accessibilityFocus', customId: 'reader-toggle:a11y-A:1',
    }] : [], 'only current prior screen-reader focus can be continued once');
    o.aboutToDisappear();
  }
}
if (selectedCase === 'toggle-accessibility-focus') {
  for (const stop of ['none', 'identity', 'disabled', 'busy', 'background', 'retired', 'screen-reader-moved']) {
    const frames = [], requests = [], events = [];
    const p = switchControls({ accessibility: { sendAccessibilityEvent: async event => { events.push(event); } } });
    const o = p.mount(p.toggle, { inputIdentity: 'both-A', value: false, onToggle() {} });
    o.getUIContext = () => ({ postFrameCallback: frame => frames.push(frame),
      getHostContext: () => ({ applicationInfo: { name: 'io.reader.minliny' } }),
      getFocusController: () => ({ requestFocus: id => requests.push(id) }) });
    const initial = nativeToggle(p, o);
    initial.onFocus(); initial.onAccessibilityFocus(true); initial.onChange(true); p.properties.flush();
    const current = nativeToggle(p, o); current.onAppear();
    frames.shift().onFrame(1000000);
    assert.equal(events.length, 0, 'accessibility request waits for actual replacement keyboard acknowledgement');
    current.onFocus();
    assert.equal(frames.length, 1);
    frames.shift().onFrame(1000000);
    await Promise.resolve(); await Promise.resolve();
    assert.equal(events.length, 1); assert.equal(frames.length, 0, 'platform acceptance alone cannot establish actual accessibility focus');
    current.onAccessibilityFocus(false);
    current.onAccessibilityFocus(true);
    current.onAccessibilityFocus(true);
    assert.equal(frames.length, 1, 'one final frame follows actual native focus acknowledgement even when it arrives after API completion');
    if (stop === 'identity') p.update(o, { inputIdentity: 'both-B' });
    if (stop === 'disabled') p.update(o, { actionEnabled: false });
    if (stop === 'busy') p.update(o, { isBusy: true });
    if (stop === 'background') o.appForeground = false;
    if (stop === 'retired') o.aboutToDisappear();
    if (stop === 'screen-reader-moved') current.onAccessibilityFocus(false);
    frames.shift().onFrame(1000000);
    assert.deepEqual(requests, stop === 'none' ? ['reader-toggle:both-A:1', 'reader-toggle:both-A:1'] : ['reader-toggle:both-A:1']);
  }
}
if (selectedCase === 'toggle-focus-identity') {
  const frames = [], events = [];
  const p = switchControls({ accessibility: { sendAccessibilityEvent: async event => { events.push(event); } } });
  const o = p.mount(p.toggle, { inputIdentity: 'identity-A', value: false, onToggle() {} });
  o.getUIContext = () => ({ postFrameCallback: frame => frames.push(frame),
    getHostContext: () => ({ applicationInfo: { name: 'io.reader.minliny' } }),
    getFocusController: () => ({ requestFocus() {} }) });
  const previous = nativeToggle(p, o);
  previous.onFocus(); previous.onAccessibilityFocus(true);
  p.update(o, { inputIdentity: 'identity-B' });
  previous.onFocus(); previous.onAccessibilityFocus(true);
  const fresh = nativeToggle(p, o);
  fresh.onChange(true); p.properties.flush(); nativeToggle(p, o).onAppear();
  assert.equal(frames.length, 0, 'new identity cannot inherit previous native keyboard or screen-reader focus');
  assert.deepEqual(events, []);
}
if (selectedCase === 'toggle-native-focus-target') {
  const frameProbe = switchControls();
  let executed = 0;
  const callback = new frameProbe.dependencies.ReaderToggleFocusFrame(() => { executed += 1; });
  callback.onIdle(1000000);
  assert.equal(executed, 0, 'critical focus does not depend on an idle budget');
  callback.onFrame(1000000);
  assert.equal(executed, 1, 'actual next-frame callback performs critical focus work');
  const frames = [], events = [];
  const p = switchControls({ accessibility: { sendAccessibilityEvent: async event => { events.push(event); } } });
  const o = p.mount(p.toggle, { inputIdentity: 'target-A', value: false, onToggle() {} });
  o.getUIContext = () => ({ postFrameCallback: frame => frames.push(frame),
    getHostContext: () => ({ applicationInfo: { name: 'io.reader.minliny' } }) });
  const first = nativeToggle(p, o);
  assert.equal(first.id, 'reader-toggle:target-A:0');
  first.onAccessibilityFocus(true); first.onChange(true); p.properties.flush();
  const second = nativeToggle(p, o); second.onAppear();
  frames.shift().onFrame(1000000); frames.shift().onFrame(1000000);
  assert.equal(events[0].customId, second.id);
  second.onChange(true); p.properties.flush();
  o.aboutToDisappear();
  assert.notEqual(events[0].customId, nativeToggle(p, o).id, 'a queued old request cannot target a successor native instance');
  for (const stop of ['none', 'identity', 'background', 'retired', 'busy']) {
    const retryFrames = [], requests = [], probe = switchControls();
    const owner = probe.mount(probe.toggle, { inputIdentity: 'retry-A', value: false, onToggle() {} });
    owner.getUIContext = () => ({ postFrameCallback: frame => retryFrames.push(frame),
      getFocusController: () => ({ requestFocus: id => { requests.push(id); throw new Error('150003 target not yet on tree'); } }) });
    const native = nativeToggle(probe, owner);
    native.onFocus(); native.onChange(true); probe.properties.flush(); nativeToggle(probe, owner).onAppear();
    retryFrames.shift().onFrame(1000000);
    assert.equal(retryFrames.length, 1, 'a thrown native focus error receives one bounded frame retry');
    if (stop === 'identity') probe.update(owner, { inputIdentity: 'retry-B' });
    if (stop === 'background') owner.appForeground = false;
    if (stop === 'retired') owner.aboutToDisappear();
    if (stop === 'busy') probe.update(owner, { isBusy: true });
    retryFrames.shift().onFrame(1000000);
    assert.equal(requests.length, stop === 'none' ? 2 : 1);
    assert.equal(retryFrames.length, 0, 'native errors cannot produce unbounded focus retries');
  }
  for (const [debug, focusTrace, expected] of [[false, true, 0], [true, false, 0], [true, true, 40]]) {
    const diagnostics = [], probe = switchControls({ debug, focusTrace, diagnostics });
    const owner = probe.mount(probe.toggle, { inputIdentity: 'trace' });
    for (let index = 0; index < 45; index += 1) owner.diagnosticFocus('finite-probe', 0);
    assert.equal(diagnostics.length, expected, 'DEBUG diagnostic requires explicit in-memory opt-in and is bounded');
  }
}
if(selectedCase==='segment'){
 const p=switchControls(),calls=[],o=p.mount(p.segment,{inputIdentity:'A',options:['跟随','浅色','深色'],optionIds:['system','day','night'],selectedIndex:0,onSelect:i=>calls.push(i)});
 const night=nativeChoice(p,o).at(-1).onClick;night();assert.deepEqual(calls,[2]);assert.equal(o.selectedIndex,0);
 p.update(o,{selectedIndex:2});assert.equal(nativeChoice(p,o).at(-1).accessibilitySelected,true);
 p.update(o,{optionIds:['night','system','day'],options:['深色','跟随','浅色'],selectedIndex:0});night();assert.deepEqual(calls,[2,0],'stable ID follows current index after reorder');
 p.update(o,{actionEnabled:false});night();p.update(o,{actionEnabled:true,isBusy:true});night();assert.equal(calls.length,2);
 p.update(o,{isBusy:false,optionIds:['system','day'],options:['跟随','浅色']});night();assert.equal(calls.length,2,'removed option cannot borrow replacement index');
 p.update(o,{optionIds:['day','day']});p.nodes(o).find(n=>n.onClick).onClick();assert.equal(calls.length,2,'duplicate IDs fail admission');
 p.update(o,{optionIds:['system','day'],inputIdentity:'B'});night();assert.equal(calls.length,2);
 const fresh=nativeChoice(p,o).at(-1);fresh.onClick();assert.equal(calls.length,3);o.aboutToDisappear();fresh.onClick();assert.equal(calls.length,3);cases++;
}
if(selectedCase==='press'){
 // Shared existing press modifier; release/cancel equals exact original
 // normal endpoint. Disabled/busy never asks the platform for a pressed fill.
 const calls=[],ColorMetrics={resourceColor(c){calls.push(c);return{red:1,green:2,blue:3,blendColor(){return{color:'pressed'};}};},rgba(){return{};}};
 for(const enabled of [true,false]){
  const p=switchControls({ColorMetrics}),o=p.mount(p.row,{label:'动作',actionEnabled:enabled,onAction:()=>{},content:()=>{}});
  const modifier=o.attributeCalls.find(a=>a.property==='attributeModifier').args[0],values={},native=new Proxy({}, {get(_t,k){return v=>{values[k]=v;return native;};}});
  modifier.applyNormalAttribute(native);const normal={...values},n=calls.length;modifier.applyPressedAttribute(native);
  assert.equal(values.backgroundColor,enabled?'pressed':normal.backgroundColor);
  if(!enabled)assert.equal(calls.length,n);
  modifier.applyNormalAttribute(native);assert.deepEqual(values,normal,'cancel/release restores surface and radius');cases++;
 }
}
if(selectedCase==='spec-propagation'){
 const baseline=switchSpecs(), width=baseline.resolveReaderSegmentSpec('app-theme-segment').width;
 const changed=specSource.replace("checkedColor: 'TOK_PRIMARY_DARK'", "checkedColor: 'TOK_GREEN'").replace(`READER_APP_THEME_SEGMENT_WIDTH = ${width};`, `READER_APP_THEME_SEGMENT_WIDTH = ${width+3};`);
 const p=switchControls({specs:switchSpecs(changed)}),t=p.mount(p.toggle,{inputIdentity:'t'}),s=p.mount(p.segment,{inputIdentity:'s',options:['A'],optionIds:['a']});
 assert.equal(nativeToggle(p,t).selectedColor,readerAppColor('TOK_GREEN','day'));
 assert.equal(p.nodes(s).find(n=>n.type==='Row').width,width+3);
 assert.equal(nativeChoice(p,s)[0].constraintSize.minHeight,44,'official V2 receives its min44 policy; native pixels/hit remain OPEN');
 assert.equal(nativeChoice(p,s)[0].border.radius,baseline.resolveReaderSegmentSpec('app-theme-segment').itemRadius);
 const pillProbe=switchControls();
 const pill=pillProbe.mount(pillProbe.segment,{specId:'pill-choice',inputIdentity:'shelf',options:['封面','列表'],optionIds:['cover','list']});
 assert.deepEqual(nativeChoice(pillProbe,pill).map(button=>button.border),[{width:0,radius:20},{width:0,radius:20}],
  'native border receives the capsule radius even when the visual border is disabled');
 assert.throws(()=>switchSpecs().resolveReaderToggleSpec('private99'),/Unknown/);assert.throws(()=>switchSpecs().resolveReaderSegmentSpec('private99'),/Unknown/);
}
if (selectedCase === 'toggle') {
  const start = toggleSource.indexOf('private canAct(identity: string): boolean {');
  const end = toggleSource.indexOf('\n  }', start);
  assert.ok(start >= 0 && end > start);
  const body = toggleSource.slice(start, end);
  for (const guard of ['identity === this.inputIdentity', 'this.actionEnabled', '!this.isBusy', 'this.mounted']) {
    assert.ok(body.includes(guard));
    const source = toggleSource.slice(0, start) + body.replace(guard, 'true') + toggleSource.slice(end);
    const p = switchControls({ toggleDefinition: source }), calls = [];
    const o = p.mount(p.toggle, { inputIdentity: 'old', onToggle: next => calls.push(next) });
    const click = nativeToggle(p, o).onChange;
    if (guard.startsWith('identity')) p.update(o, { inputIdentity: 'new' });
    if (guard === 'this.actionEnabled') p.update(o, { actionEnabled: false });
    if (guard === '!this.isBusy') p.update(o, { isBusy: true });
    if (guard === 'this.mounted') o.aboutToDisappear();
    click(true);
    assert.equal(calls.length, 1, 'removed canAct guard admits the actual illegal action: ' + guard);
  }
}

const req=createRequire(import.meta.url),sdk=resolveEtsLoaderRoot();
// Original production consumer methods and native shared controls execute in
// one installed SDK property runtime. No business owner algorithm is copied.
function consumer(file,members,params={},extra={}){
 const p=switchControls();Object.assign(p.dependencies,readerFoundationTokens);
 const o=p.consumer(read('entry/src/main/ets/features/'+file+'.ets'),members,extra,params);return{p,o};
}
if (selectedCase === 'source-row-value') {
 const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
 const file = new URL('../entry/src/main/ets/features/source/ui/SourceManagementPage.ets', import.meta.url);
 const Keys = selectedProductionMethods(file, 'SourceManagementPage', ['sourceRenderKey', 'sourceRowKey']);
 const keys = new Keys();
 const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
 const { ts, options } = installedEtsCompiler();
 const tree = ts.createSourceFile('SourceManagementPage.ets', readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
 const component = tree.statements.find(node => node.name?.text === 'SourceManagementPage');
 const list = component.members.find(node => node.name?.getText(tree) === 'sourceList');
 assert.match(list.getText(tree), /\(source: BookSource\): string => this\.sourceRowKey\(source\)/, 'normal LazyForEach binds the value-independent row key');
 const source = { sourceId: 'source-A', name: 'Current source', baseUrl: 'https://source.test',
   sourceVersion: 'version-A', category: 'novel', enabled: true, checkState: 'unchecked' };
 assert.equal(keys.sourceRowKey(source), keys.sourceRowKey({ ...source, enabled: false, sourceVersion: 'version-B' }),
   'accepted enabled-only value retains the LazyForEach row and ReaderToggle owner');
 for (const change of [{ sourceVersion: 'version-B' }, { checkState: 'checking' }, { name: 'Changed source' }]) {
   assert.notEqual(keys.sourceRenderKey(source), keys.sourceRenderKey({ ...source, ...change }),
     'definition and row content changes keep their existing retirement boundary');
 }
 const calls = [];
 const { p, o } = consumer('source/SourceManagementPage', ['operation', 'projectedSources', 'sourceSwitch',
   'sourceSwitchValue', 'sourceSwitchName', 'currentSourceRow', 'sourceRowToggle', 'sourceRowIsCurrent', 'sourceRenderKey',
   'sourceToggleBusy', 'sourceActionEnabled', 'managementBackIsCurrent', 'managementOpeningIsCurrent'],
   { operation: { action: 'load', sourceId: '' } });
 Object.assign(o, { mounted: true, appForeground: true, temporaryBackIdentity: 'source-row-visit',
   managementOpeningIsCurrent: () => true, projectedSources: [source],
   onToggleSource(id, next) {
     calls.push([id, next]);
     o.projectedSources = [{ ...source, enabled: next, sourceVersion: next ? 'version-C' : 'version-B' }];
   } });
 const staleRowAction = o.sourceRowToggle(source);
 const rowAction = next => o.sourceRowToggle(o.currentSourceRow(source))(next);
 o.sourceSwitch(source.enabled, rowAction, source.sourceId, source.name);
 const actor = [...o.children.values()][0];
 const original = nativeToggle(p, actor);
 assert.equal(actor.value, true);
 original.onFocus(); original.onChange(false); p.properties.flush();
 assert.equal([...o.children.values()][0], actor, 'same real SDK ReaderToggle component');
 assert.equal(actor.value, false, 'current projected value reaches retained child through SDK dependency update');
 assert.equal(nativeToggle(p, actor).create.isOn, false);
 assert.equal(actor.nativeRevision, 1, 'only the existing native child replacement advances');
 original.onChange(true);
 assert.deepEqual(calls, [['source-A', false]], 'retired native revision cannot act');
 const current = nativeToggle(p, actor); current.onFocus(); current.onChange(true); p.properties.flush();
 assert.equal(actor.value, true); assert.equal(actor.nativeRevision, 2);
 assert.deepEqual(calls, [['source-A', false], ['source-A', true]], 'original current-row callback survives accepted value updates');
 o.projectedSources = [{ ...source, sourceVersion: 'version-D' }]; staleRowAction(false);
 assert.equal(calls.length, 2, 'old source definition callback remains invalid');
 o.projectedSources = []; rowAction(false);
 assert.equal(calls.length, 2, 'removed source callback remains invalid');
 cases++;
}
if(selectedCase==='source'){
 const calls=[],{p,o}=consumer('source/SourceManagementPage',['operation','projectedSources','sourceSwitch','sourceSwitchValue','sourceSwitchName','sourceToggleBusy','sourceActionEnabled','managementBackIsCurrent','feedbackIdentity'],{operation:{action:'load',sourceId:''}});
 Object.assign(o,{mounted:true,appForeground:true,statusKind:'idle',statusMessage:'',scheduleSourceAnchorRestore(){},managementOpeningIsCurrent:()=>true,temporaryBackIdentity:'source-visit',onToggleSource:(id,next)=>calls.push([id,next])});o.sourceSwitch(false,next=>o.onToggleSource('source-A',next),'source-A');
 const actor=[...o.children.values()][0];nativeToggle(p,actor).onChange(true);assert.deepEqual(calls,[['source-A',true]]);
 p.update(actor,{value:true});nativeToggle(p,actor).onChange(false);assert.deepEqual(calls.at(-1),['source-A',false]);
 o.operation={action:'toggle',sourceId:'source-A',original:{blocked:true,busy:false}};o.replay();p.properties.flush();nativeToggle(p,actor).onChange(false);assert.equal(calls.length,2);cases++;
}
if(selectedCase==='settings'){
 const {defaults}=await import('./lib/general-settings-persistence-probe.mjs');
 const calls=[],Runtime={isCurrent:owner=>owner===Runtime},members=['snapshot','operation','appThemeScheme','autoCheckUpdateValue','tapBottomScrollTopValue','reduceMotionValue','crashLogValue','temporaryBackIdentity','onSnapshotChanged','syncSnapshotValues','switchRow','toggleSetting','settingValue','settingToggleBusy','settingCanToggle','settingsInputIsCurrent','operationFeedbackIdentity'];
 const {p,o}=consumer('settings/SettingsPage',members,{}, {ReaderRuntimeOwner:Runtime,createDefaultSettingsSnapshot:()=>({...defaults})});Object.assign(o,{mounted:true,isOpeningCurrent:()=>true,lastOperationFeedback:'0:0',themeOwner:Runtime,resetInFlight:false,onToggle:(key,next)=>calls.push([key,next])});o.temporaryBackIdentity='visit-A';o.syncSnapshotValues();o.switchRow('减少动态效果',()=>({id:1}),'reduceMotion');
 const row=[...o.children.values()].find(c=>c instanceof p.dependencies.ReaderFormRow);
 const actor=[...o.children.values()].find(c=>c instanceof p.dependencies.ReaderToggle);
 assert.ok(row);const label=p.nodes(row).find(n=>n.type==='Button'&&n.onClick);
 assert.ok(label);assert.equal(label.focusable,false);assert.equal(label.accessibilityLevel,'no-hide-descendants');
 assert.ok(p.nodes(row).filter(n=>n.type==='Row').every(n=>!n.onClick),'label action and switch are siblings');
 nativeToggle(p,actor).onChange(true);assert.equal(o.reduceMotionValue,false,'page does not preflip an unaccepted value');assert.deepEqual(calls,[['reduceMotion',true]]);
 p.update(o,{snapshot:{autoCheckUpdate:true,tapBottomScrollTop:true,reduceMotion:true,crashLog:true,developerMode:false}});assert.equal(o.reduceMotionValue,true);label.onClick();assert.deepEqual(calls.at(-1),['reduceMotion',false]);
 p.update(o,{operation:{action:'toggle',receipt:{receipt:{confirmation:'unknown'},facts:{fact:'pendingReconciliation'}}}});nativeToggle(p,actor).onChange(false);label.onClick();assert.equal(calls.length,2,'both targets respect real unknown');
 p.update(o,{operation:{action:'toggle',receipt:{receipt:{confirmation:'confirmed'},facts:{fact:'refreshing'}}}});nativeToggle(p,actor).onChange(false);label.onClick();assert.equal(calls.length,2,'both targets respect real pending');
 p.update(o,{operation:{action:'load'}});const stale=nativeToggle(p,actor);o.temporaryBackIdentity='visit-B';p.properties.flush();stale.onChange(false);assert.equal(calls.length,2,'old row opening never borrows a new control');o.mounted=false;stale.onChange(false);assert.equal(calls.length,2);cases++;
}
if(selectedCase==='rules'){
 const {p,o}=consumer('settings/RulesManagementPage',['snapshot','booleanField','mounted','draftOpening','replaceDraftRevision','txtDraftRevision','dictDraftRevision','subscriptionDraftRevision','draftKey','draftIsCurrent'],{snapshot:{busy:true,ruleMutation:{blocked:true},receipt:{receipt:{confirmation:'unknown'}}}},{EMPTY_RULES_MANAGEMENT_SNAPSHOT:{}});Object.assign(o,{replaceId:1,txtId:2,dictName:'词典',subId:3});let draft=false;
 o.mounted=true;o.draftOpening=1;o.booleanField('启用',()=>draft,next=>draft=next,o.draftKey('replace'));const actor=[...o.children.values()][0];nativeToggle(p,actor).onChange(true);assert.equal(draft,true,'local draft remains editable; pending write is not a draft mutation');cases++;
}

if(selectedCase==='rss-management'){
 const calls=[],{p,o}=consumer('rss/ui/RssSubscriptionManagementPage',['operation','presentationIdentity','expandedSubscriptionId','isExpanded','subscriptionItem','actionBar','actionTarget'],{operation:undefined,presentationIdentity:'rss-A'});
 Object.assign(o,{onToggle:(id,next)=>calls.push([id,next])});o.subscriptionItem({subscriptionId:'s',title:'订阅',feedUrl:'https://feed.test',enabled:false},0);
 const actor=[...o.children.values()].find(c=>c instanceof p.dependencies.ReaderToggle);
 nativeToggle(p,actor).onChange(true);assert.deepEqual(calls,[['s',true]]);p.update(actor,{value:true});nativeToggle(p,actor).onChange(false);assert.deepEqual(calls.at(-1),['s',false],'actual item callback forwards current next value, not captured item enabled');
 p.update(o,{operation:{projection:{receipt:{confirmation:'unknown'},facts:{fact:'pendingReconciliation'}},original:{blocked:true,busy:false}}});const stale=nativeToggle(p,actor);stale.onChange(false);assert.equal(calls.length,2,'immediate durable RSS write waits for exact receipt');
 p.update(o,{operation:undefined,presentationIdentity:'rss-B'});stale.onChange(false);assert.equal(calls.length,2,'retained native actor old presentation rejected');cases++;
}
if(selectedCase==='rss-editor'){
 const {rssOriginalMatchesScope}=await import('../entry/src/main/ets/features/rss/application/RssMutationRecoveryContract.ts');
 const p=switchControls();Object.assign(p.dependencies,readerFoundationTokens,{rssOriginalMatchesScope});
 const t=req(sdk+'/node_modules/typescript'),options=req(sdk+'/lib/ets_checker.js').compilerOptions;
 const editor=read('entry/src/main/ets/features/rss/ui/RssSubscriptionEditorPage.ets'),ownerSource=read('entry/src/main/ets/features/rss/application/RssSubscriptionEditorOrchestrator.ets');
 const tree=t.createSourceFile(virtualFilePath('RssEditor.ets'),ownerSource,t.ScriptTarget.Latest,true,t.ScriptKind.ETS,options);
 const declaration=tree.statements.find(n=>t.isVariableStatement(n)&&n.declarationList.declarations.some(d=>d.name.getText(tree)==='EMPTY_RSS_EDITOR_SNAPSHOT')).declarationList.declarations[0];
 const {projectOperationFacts}=await import('../entry/src/main/ets/app/ReaderOperationFacts.ts');
 const {stripTypeScriptTypes}=await import('node:module');
 const empty=new Function('projectOperationFacts',stripTypeScriptTypes('const empty = '+declaration.initializer.getText(tree)+';')+'return empty;')(projectOperationFacts);
 const recovery=(await import('./lib/bounded-surface-sdk-probe.mjs')).boundedSurfaceSdk();
 for(const name of ['ReaderRecoveryNotice','ReaderRecoveryAction'])p.dependencies[name]=recovery.deps[name];
 const shared=read('entry/src/main/ets/features/rss/ui/RssOriginalRecoverySurface.ets');p.hooks.childSources.RssOriginalRecoverySurface=shared;
 p.dependencies.RssOriginalRecoverySurface=createReaderBuilderProbe(shared,boundedMembers(shared),p.dependencies,p.hooks).Component;
 const o=p.consumer(editor,['snapshot','presentationIdentity','pageContent','editorField','sectionTitle','saveAction','operationRecovery','recoveryActionIdentities','recoveryGeneration','dispatchRecovery'],{EMPTY_RSS_EDITOR_SNAPSHOT:empty}, {snapshot:empty,presentationIdentity:'editor-A'});
 const calls=[];Object.assign(o,{onEnabledChanged:next=>calls.push(['enabled',next]),onEnabledCookieJarChanged:next=>calls.push(['cookie',next])});o.pageContent();
 const actors=[...o.children.values()].filter(c=>c instanceof p.dependencies.ReaderToggle);assert.equal(actors.length,2,'both real page content declarations mount SDK shared Toggle');
 actors.forEach(a=>nativeToggle(p,a).onChange(!a.value));assert.deepEqual(calls,[['enabled',!empty.enabled],['cookie',!empty.enabledCookieJar]]);
 p.update(o,{snapshot:{...empty,enabled:!empty.enabled,enabledCookieJar:!empty.enabledCookieJar,busy:true,canSave:false,operation:{receipt:{confirmation:'unknown'},facts:{canRetry:false}},original:undefined}});
 const physical=actors.map(a=>({ node:nativeToggle(p,a), next:!a.value }));physical.forEach(({node,next})=>node.onChange(next));assert.deepEqual(calls.slice(-2),[['enabled',empty.enabled],['cookie',empty.enabledCookieJar]],'actual native drafts remain editable while original save unresolved');
 p.update(o,{presentationIdentity:'editor-B'});physical.forEach(({node,next})=>node.onChange(next));assert.equal(calls.length,4,'old physical editor action cannot borrow replacement presentation');
 actors.forEach(a=>a.aboutToDisappear());physical.forEach(({node,next})=>node.onChange(next));assert.equal(calls.length,4);cases+=2;
}
const appThemeMembers = ['appThemeMode', 'temporaryBackIdentity', 'appThemeControlGeneration', 'appThemeControl',
 'settingsInputIsCurrent', 'themeIndex', 'appThemeControlIdentity', 'appThemeControlIsCurrent', 'settingsNavigationCurrent', 'selectAppTheme'];
if(selectedCase==='theme'){
 const p=switchControls(),runtime={},calls=[];
 let openingCurrent = true;
 const o=p.consumer(read('entry/src/main/ets/features/settings/ui/SettingsPage.ets'),appThemeMembers,{SEG_OPTIONS:['跟随','浅色','深色'],ReaderRuntimeOwner:{isCurrent:owner=>owner===runtime}});
 Object.assign(o,{mounted:true,themeOwner:runtime,activeSection:'general',developerPageId:'',appThemeMode:'system',
  isOpeningCurrent:()=>openingCurrent,onSelectAppTheme:async mode=>{calls.push(mode);}});
 o.temporaryBackIdentity='theme-A';o.appThemeControl();const actor=[...o.children.values()].find(c=>c instanceof p.dependencies.ReaderSegmentedControl),click=nativeChoice(p,actor).at(-1).onClick;
 click();assert.deepEqual(calls,['night']);assert.equal(actor.selectedIndex,0,'page waits for original ThemeHost accepted mode');
 o.appThemeMode='night';p.properties.flush();assert.equal(actor.selectedIndex,2,'accepted mode propagates into same native component');
 openingCurrent=false;click();assert.equal(calls.length,1,'retired Settings opening blocks an otherwise mounted native control');
 openingCurrent=true;
 o.temporaryBackIdentity='theme-B';p.properties.flush();click();assert.equal(calls.length,1);o.mounted=false;click();assert.equal(calls.length,1);cases++;
}

if(selectedCase==='lazy-theme'){
 // Root's bounded lazy dependency resolver must mount the same real control
 // when a parent omits explicit common-child dependencies. Prop delivery is
 // exercised through its retained child, never a dummy capturing component.
 const runtime={},calls=[];
 const probe=createReaderBuilderProbe(read('entry/src/main/ets/features/settings/ui/SettingsPage.ets'),appThemeMembers,{
  SEG_OPTIONS:['跟随','浅色','深色'],ReaderRuntimeOwner:{isCurrent:owner=>owner===runtime},
 });
 const o=probe.owner;Object.assign(o,{mounted:true,themeOwner:runtime,activeSection:'general',developerPageId:'',appThemeMode:'system',
  isOpeningCurrent:()=>true,onSelectAppTheme:async mode=>{calls.push(mode);}});
 o.temporaryBackIdentity='lazy-theme';o.appThemeControl();
 const actor=[...o.children.values()].find(c=>c.nodes&&[...c.nodes.values()].some(n=>n.type==='Button'&&n.accessibilityRole==='AccessibilityRoleType.RADIO'));
 assert.ok(actor,'omitted dependency resolved to actual ReaderSegmentedControl native radio nodes');
 const night=[...actor.nodes.values()].filter(n=>n.type==='Button').at(-1).onClick;night();assert.deepEqual(calls,['night']);
 o.appThemeMode='night';o.replay();assert.equal([...o.children.values()].includes(actor),true,'lazy real child remains retained');
 assert.equal([...actor.nodes.values()].filter(n=>n.type==='Button').at(-1).accessibilitySelected,true,'Root hook flushes actual retained child Prop update');
 o.appThemeControlGeneration+=1;night();assert.equal(calls.length,1,'same mount with a new General section rejects the prior native callback');
 o.temporaryBackIdentity='lazy-retired';night();assert.equal(calls.length,1,'lazy child never bypasses original physical identity admission');
 
}

}
