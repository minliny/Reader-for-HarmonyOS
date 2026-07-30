import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const store = read('entry/src/main/ets/ui/store/ReaderUiStore.ets');
const overlayComponents = read('entry/src/main/ets/ui/components/ReaderOverlayComponents.ets');
const directoryOverlay = read('entry/src/main/ets/ui/components/ReaderDirectoryOverlay.ets');
const visualAdmission = read('entry/src/main/ets/contract/reader_ui/VisualAdmission.ets');

function section(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `missing ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, `missing ${endMarker}`);
  return source.slice(start, end);
}

test('B5 generated admission enables only the exact Directory module record', () => {
  assert.match(
    visualAdmission,
    /recordId:\s*'reader\.module\.directory'[\s\S]{0,160}admission:\s*'implementation-ready'/,
  );
  assert.match(
    visualAdmission,
    /overlayKind:\s*'directory'[\s\S]{0,160}admission:\s*'implementation-ready'/,
  );
  for (const recordId of ['tts', 'appearance', 'settings']) {
    assert.match(
      visualAdmission,
      new RegExp(
        `recordId: 'reader\\.module\\.${recordId}', admission: 'candidate-backport', ` +
        'sourceBound: true, implementationReady: false',
      ),
    );
  }
});

test('B5 bottom bar dispatches the schema-3 module event and never the legacy Directory alias', () => {
  const bottom = section(
    overlayComponents,
    'export struct ReaderBottomBar',
    '// ── Panel shell',
  );
  assert.match(bottom, /if \(!this\.readerModuleAdmitted\(kind\)\) return;/);
  assert.match(bottom, /payload\['module'\] = kind/);
  assert.match(bottom, /type: 'reader\.module\.switch'/);
  assert.match(bottom, /readerUIJSONPayload: payload/);
  assert.doesNotMatch(bottom, /reader\.directory\.open|reader-module-switch/);
});

test('B5 Store consumes admitted module events before every legacy owner', () => {
  const gate = store.indexOf('if (ReaderUiStore.dispatchAdmittedReaderControl(event)) return;');
  const legacy = store.indexOf('dispatchBookOpenCancellation(event');
  const consumer = section(
    store,
    'private static dispatchAdmittedReaderControl',
    'static snapshot()',
  );
  assert.ok(gate >= 0 && legacy > gate);
  assert.match(consumer, /event\.type === 'reader\.module\.switch'/);
  assert.match(consumer, /ReaderUiStore\.readerModuleFromEvent\(event\)/);
  assert.match(consumer, /ReaderUiVisualAdmission\.isRecordAdmitted\(`reader\.module\.\$\{module\}`\)/);
  assert.match(consumer, /ReaderControlCandidateAdapter\.consume\(event, ReaderUiStore\.state\)/);
  assert.doesNotMatch(consumer, /ReaderReducer\.reduce|runtimeShadow/);
});

test('B5 exact Directory overlay has one visual tree and no synthesized bookmark state', () => {
  const panel = section(
    overlayComponents,
    'export struct ReaderDirectoryPanel',
    '// ── Appearance panel',
  );
  for (const symbol of [
    'ReaderControlDismissZone()',
    'ReaderTopArea()',
    'ReaderDirectoryPanel()',
    'ReaderBottomBar()',
  ]) {
    assert.equal(directoryOverlay.split(symbol).length - 1, 1);
  }
  assert.doesNotMatch(directoryOverlay + panel, /ReaderBase\s*\(|\.width\(0\)|\.height\(0\)/);
  assert.doesNotMatch(panel, /ReaderFullBookmarkRow|set-toc-mode|bookmarks|tocMode/);
  assert.match(panel, /Text\('书签'\)/);
  assert.match(panel, /ReaderTocLiveRow\(\{/);
});
