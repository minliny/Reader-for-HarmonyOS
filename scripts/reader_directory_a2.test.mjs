import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const overlayHost = read('entry/src/main/ets/ui/slots/OverlayHost.ets');
const directoryOverlay = read('entry/src/main/ets/ui/components/ReaderDirectoryOverlay.ets');
const overlayComponents = read('entry/src/main/ets/ui/components/ReaderOverlayComponents.ets');
const visualAdmission = read('entry/src/main/ets/contract/reader_ui/VisualAdmission.ets');

function sourceSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `missing source marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, `missing source marker after ${startMarker}: ${endMarker}`);
  return source.slice(start, end);
}

test('A2 Directory composition contains the four exact overlay layers once', () => {
  for (const symbol of [
    'ReaderControlDismissZone()',
    'ReaderTopArea()',
    'ReaderDirectoryPanel()',
    'ReaderBottomBar()',
  ]) {
    assert.equal(directoryOverlay.split(symbol).length - 1, 1,
      `${symbol} must be composed exactly once`);
  }
  assert.doesNotMatch(directoryOverlay, /ReaderBase\s*\(/,
    'the admitted reading surface, not the overlay, owns ReaderBase');
  assert.doesNotMatch(directoryOverlay, /\.width\(0\)|\.height\(0\)/,
    'A2 preparation must not hide a parallel visual tree');
});

test('A2 ReaderDirectoryPanel reuses the canonical shell and emits no hidden state substitute', () => {
  const legacyPanel = sourceSection(
    overlayComponents,
    'export struct DirectoryPanel',
    '// Exact quick Directory module panel',
  );
  const panel = sourceSection(
    overlayComponents,
    'export struct ReaderDirectoryPanel',
    '// ── Appearance panel',
  );
  assert.match(panel, /ReaderModulePanelShell\(\{ debugLabel: 'ReaderModulePanel' \}\)/);
  assert.match(panel, /Text\('目录'\)/);
  assert.match(panel, /Text\('书签'\)/);
  assert.match(panel, /ReaderTocLiveRow\(\{/);
  assert.doesNotMatch(panel, /DirectoryPanel\(\)|ReaderFullBookmarkRow|set-toc-mode|bookmarks|tocMode/);
  assert.doesNotMatch(panel, /\.width\(0\)|\.height\(0\)/,
    'exact Directory must emit no hidden placeholder');
  assert.doesNotMatch(legacyPanel, /\.width\(0\)|\.height\(0\)/,
    'A2 cleanup must remove zero-size placeholders from the old native panel');
  assert.doesNotMatch(panel, /reader-directory-overlay-v2|toc-bookmarks/);
});

test('A2 OverlayHost gates Directory before the component branch and remains non-emitting pre-promotion', () => {
  const gateIndex = overlayHost.indexOf('ReaderUiVisualAdmission.isOverlayAdmitted(this.overlayKind)');
  const branchIndex = overlayHost.indexOf("this.overlayKind === 'directory'");
  const componentIndex = overlayHost.indexOf('ReaderDirectoryOverlay()');
  assert.ok(gateIndex >= 0 && branchIndex > gateIndex && componentIndex > branchIndex);
  assert.doesNotMatch(overlayHost, /directory[\s\S]{0,240}\.width\(0\)|directory[\s\S]{0,240}\.height\(0\)/);
  assert.match(visualAdmission, /static admissionForOverlay\(overlayKind: string\)/);
  assert.doesNotMatch(
    visualAdmission,
    /overlayKind:\s*'directory'[\s\S]{0,160}admission:\s*'implementation-ready'/,
    'A2 must not activate Directory before B4 promotion',
  );
});

test('A2 Directory preparation does not reintroduce retired routes or pre-F3 motion', () => {
  assert.doesNotMatch(directoryOverlay, /reader-directory-overlay-v2|toc-bookmarks/);
  const branch = overlayHost.slice(
    overlayHost.indexOf("this.overlayKind === 'directory'"),
    overlayHost.indexOf("this.overlayKind === 'bookshelf-multiselect'"),
  );
  assert.doesNotMatch(branch, /TransitionEffect|MotionAdapter|animateTo/);
});
