import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const overlayHost = read('entry/src/main/ets/ui/slots/OverlayHost.ets');
const controlHome = read('entry/src/main/ets/ui/components/ReaderControlHomeOverlay.ets');
const visualAdmission = read('entry/src/main/ets/contract/reader_ui/VisualAdmission.ets');

test('A2 control-home composition contains the three exact overlay layers once', () => {
  for (const symbol of ['ReaderTopArea()', 'ReaderControlSheet()', 'ReaderBottomBar()']) {
    assert.equal(controlHome.split(symbol).length - 1, 1, `${symbol} must be composed exactly once`);
  }
  assert.doesNotMatch(controlHome, /ReaderBase\s*\(/,
    'the admitted reading surface, not the overlay, owns ReaderBase');
  assert.doesNotMatch(controlHome, /\.width\(0\)|\.height\(0\)/,
    'A2 preparation must not hide a parallel visual tree');
});

test('A2 OverlayHost gates reader-control before it reaches the component branch', () => {
  const gateIndex = overlayHost.indexOf('ReaderUiVisualAdmission.isOverlayAdmitted(this.overlayKind)');
  const branchIndex = overlayHost.indexOf("this.overlayKind === 'reader-control'");
  const componentIndex = overlayHost.indexOf('ReaderControlHomeOverlay()');
  assert.ok(gateIndex >= 0 && branchIndex > gateIndex && componentIndex > branchIndex);
  assert.doesNotMatch(overlayHost, /reader-control[\s\S]{0,240}\.width\(0\)|reader-control[\s\S]{0,240}\.height\(0\)/);
});

test('A2 remains fail closed against the pre-promotion consumer admission table', () => {
  assert.match(visualAdmission, /static admissionForOverlay\(overlayKind: string\)/);
  assert.match(visualAdmission, /return 'blocked';/);
  assert.doesNotMatch(
    visualAdmission,
    /overlayKind:\s*'reader-control'[\s\S]{0,160}admission:\s*'implementation-ready'/,
  );
});
