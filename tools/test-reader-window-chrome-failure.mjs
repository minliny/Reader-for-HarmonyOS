import assert from 'node:assert/strict';
import { setImmediate as settle } from 'node:timers/promises';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const cases = {
  'unsupported-style': {
    description: 'One 801 result settles the same chrome style across repeated requests, visible controls and foreground restore.',
    resources: [],
  },
  'window-epoch': {
    description: 'A late 801 from a retired epoch cannot settle the same app style on a replacement or reinstalled window.',
    resources: [],
  },
  'transient-retry': {
    description: 'A transient chrome failure waits for an explicit trigger and the same native style can then succeed.',
    resources: [],
  },
  'metrics-refresh': {
    description: 'Native window-property read failure preserves last metrics and does not escape window or configuration callbacks.',
    resources: [],
  },
};

const checks = {
  async 'unsupported-style'(f) {
    const win = f.windowPort();
    await f.C.install(win);
    await settle();
    const color = '#FF223344';
    const style = new f.S(color, 'light');
    let rejectWrite;
    win.nextColor = { promise: new Promise((_resolve, reject) => { rejectWrite = reject; }) };
    f.C.requestReaderChrome(style);
    f.C.requestReaderChrome(new f.S(color, 'light'));
    f.C.reapplyChrome();
    rejectWrite({ code: 801 });
    await settle();
    for (let opening = 0; opening < 3; opening++) {
      await f.C.requestReaderWindowPolicy(new f.P('system', false, false, false, false));
      f.C.requestReaderChrome(new f.S(color, 'light'));
    }
    f.C.reapplyChrome();
    await settle();
    assert.equal(f.colors(win).filter(([, write]) => write.statusBarColor === color).length, 1);
    assert.equal(f.warnings.filter(args => args[3]?.includes('"errorCode":"801"')).length, 1);
    assert.notEqual(win.properties.statusBarColor, color, 'unsupported is not an applied native color');

    f.C.requestReaderChrome(new f.S('#FF334455', 'light'));
    await settle();
    assert.equal(win.properties.statusBarColor, '#FF334455', 'a distinct style is eligible for a native write');
  },

  async 'window-epoch'(f) {
    const original = f.windowPort();
    let rejectOldWrite;
    original.nextColor = { promise: new Promise((_resolve, reject) => { rejectOldWrite = reject; }) };
    await f.C.install(original);
    const replacement = f.windowPort();
    await f.C.install(replacement);
    rejectOldWrite({ code: 801 });
    await settle();
    assert.equal(f.colors(replacement).length, 1);
    assert.equal(replacement.properties.statusBarColor, '#F8F4EC');

    const failInstalledWrite = Promise.reject({ code: 801 });
    failInstalledWrite.catch(() => {});
    replacement.nextColor = { promise: failInstalledWrite };
    f.C.reapplyChrome();
    await settle();
    const writesBeforeReinstall = f.colors(replacement).length;
    await f.C.install(replacement);
    await settle();
    assert.equal(f.colors(replacement).length, writesBeforeReinstall + 1, 'reinstall of the same Window is a new epoch');
    assert.equal(replacement.properties.statusBarColor, '#F8F4EC');
  },

  async 'transient-retry'(f) {
    const win = f.windowPort();
    await f.C.install(win);
    await settle();
    const color = '#FF778899';
    await f.C.requestReaderWindowPolicy(new f.P('system', false, false, false, false));
    let rejectWrite;
    win.nextColor = { promise: new Promise((_resolve, reject) => { rejectWrite = reject; }) };
    f.C.requestReaderChrome(new f.S(color, 'light'));
    rejectWrite({ code: 1300003 });
    await settle();
    assert.equal(f.colors(win).filter(([, write]) => write.statusBarColor === color).length, 1);
    assert.notEqual(win.properties.statusBarColor, color);

    await f.C.requestReaderWindowPolicy(new f.P('system', false, false, false, false));
    await settle();
    assert.equal(f.colors(win).filter(([, write]) => write.statusBarColor === color).length, 2);
    assert.equal(win.properties.statusBarColor, color);
  },

  async 'metrics-refresh'(f) {
    const win = f.windowPort();
    await f.C.install(win);
    const initial = f.C.metrics();
    const getProperties = win.getWindowProperties;
    win.getWindowProperties = () => { throw { code: 1300003 }; };
    assert.doesNotThrow(() => win.events.get('windowSizeChange')({}));
    assert.doesNotThrow(() => f.C.refreshConfiguration({ fontSizeScale: 2 }, win));
    assert.equal(f.C.metrics(), initial);
    assert.equal(f.warnings.filter(args => args.includes('metrics') && args.includes('1300003')).length, 2);
    win.getWindowProperties = getProperties;
    win.rect = { ...win.rect, width: 405 };
    win.events.get('windowSizeChange')({});
    assert.equal(f.C.metrics().windowRect.width, 405);
    assert.equal(f.C.metrics().systemFontScale, 2);

    const invalid = f.windowPort();
    invalid.getWindowProperties = () => { throw new Error('window properties are unavailable'); };
    await assert.rejects(f.C.install(invalid), /window properties are unavailable/);
    f.C.requestAppChrome();
    await settle();
    assert.deepEqual(f.colors(invalid), [], 'a failed install never publishes its window as the native chrome writer');
  },
};

for (const id of selectContractCases(cases)) {
  const { createWindowCoordinatorFixture } = await import('./lib/reader-window-coordinator-fixture.mjs');
  const fixture = await createWindowCoordinatorFixture();
  try {
    await checks[id](fixture);
    recordContractCasePass(id);
  } finally {
    fixture.cleanup();
  }
}
