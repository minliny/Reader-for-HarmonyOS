import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const store = read('entry/src/main/ets/ui/store/ReaderUiStore.ets');
const tapZoneAdapter = read('entry/src/main/ets/ui/router/ReaderUIScreenGraphTapZoneAdapter.ets');
const overlayComponents = read('entry/src/main/ets/ui/components/ReaderOverlayComponents.ets');
const controlHome = read('entry/src/main/ets/ui/components/ReaderControlHomeOverlay.ets');
const visualAdmission = read('entry/src/main/ets/contract/reader_ui/VisualAdmission.ets');

test('B5 admits only the exact reader-control overlay', () => {
  assert.match(
    visualAdmission,
    /overlayKind:\s*'reader-control'[\s\S]{0,160}admission:\s*'implementation-ready'/,
  );
  assert.match(store, /ReaderUiVisualAdmission\.isOverlayAdmitted\('reader-control'\)/);
});

test('B5 production dispatch consumes the semantic toggle before legacy paths', () => {
  const gate = store.indexOf('if (ReaderUiStore.dispatchAdmittedReaderControl(event)) return;');
  const legacy = store.indexOf('dispatchBookOpenCancellation(event');
  assert.ok(gate >= 0 && legacy > gate);
  assert.match(store, /ReaderControlCandidateAdapter\.consume\(event, ReaderUiStore\.state\)/);
  assert.match(store, /if \(event\.type === 'reader\.module\.switch'\) return true;/);
});

test('B5 tap-zone adapter preserves route identity', () => {
  assert.match(tapZoneAdapter, /type:\s*'reader\.control\.toggle'/);
  assert.match(tapZoneAdapter, /payload\['overlay'\]\s*=\s*'reader-control'/);
  assert.doesNotMatch(tapZoneAdapter, /route-push[\s\S]{0,80}id:\s*'reader'/);
});

test('B5 keeps separately admitted reader modules inert', () => {
  assert.match(
    overlayComponents,
    /ReaderUiVisualAdmission\.isRecordAdmitted\(recordId\)/,
  );
  const guard = overlayComponents.indexOf('if (!this.readerModuleAdmitted(kind)) return;');
  const dispatch = overlayComponents.indexOf("ReaderUiStore.dispatch({ type: 'reader-module-switch'");
  assert.ok(guard >= 0 && dispatch > guard);
  for (const recordId of [
    'reader.module.directory',
    'reader.module.tts',
    'reader.module.appearance',
    'reader.module.settings',
  ]) {
    assert.match(
      visualAdmission,
      new RegExp(
        `recordId: '${recordId.replaceAll('.', '\\.')}', admission: 'candidate-backport', ` +
        'sourceBound: true, implementationReady: false',
      ),
    );
  }
});

test('B5 composes no duplicate or hidden reading surface', () => {
  assert.doesNotMatch(controlHome, /ReaderBase\s*\(/);
  assert.doesNotMatch(controlHome, /\.width\(0\)|\.height\(0\)/);
  for (const symbol of ['ReaderTopArea()', 'ReaderControlSheet()', 'ReaderBottomBar()']) {
    assert.equal(controlHome.split(symbol).length - 1, 1);
  }
});
