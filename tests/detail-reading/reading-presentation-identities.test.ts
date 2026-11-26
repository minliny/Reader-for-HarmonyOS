import assert from 'node:assert/strict';
import test from 'node:test';
import { ReaderPageChromeSnapshot } from '../../entry/src/main/ets/features/reading/presentation/ReaderPageChromeModel.ts';
import { readerPageSurfaceIdentity, readerPageTextureIdentity }
  from '../../entry/src/main/ets/features/reading/ui/ReaderPageTurnIdentities.ts';
import { ReaderSessionMorphMeasurements, ReaderSessionMorphSourceMeasurement }
  from '../../entry/src/main/ets/features/reading/ui/ReaderSessionMorphState.ts';

test('the native surface identity and texture identity retain their exact format and independent axes', () => {
  const chrome = new ReaderPageChromeSnapshot('Book', '11:45', 'Chapter', '20%', true, 96, 24);
  assert.equal(readerPageSurfaceIdentity('local', 'book', 'paper', 'previous', 7, 33, 'version', 'layout'),
    'reader-page:local:book:7:33:version:layout:paper:previous');
  assert.equal(readerPageTextureIdentity('local', 'book', 'paper', true, false, 7, 33, 'version',
    'layout', 2.125, chrome, 'filled', 'facing'),
  'reader-bookturn-texture-v2|local|book|7|33|version|layout|paper|2.125|status-hidden|Book|11:45|Chapter|20%|true|96|24|filled|page-chrome|facing');
  const basic = readerPageTextureIdentity('local', 'book', 'paper', false, true, 7, 33, 'version', 'layout', 0, chrome);
  assert.match(basic, /status-visible/);
  assert.match(basic, /\|hidden\|session-overlay$/);
});

test('the capsule source cache qualifies an exact actor against the current layout lazily', () => {
  const owner = new ReaderSessionMorphMeasurements();
  let reads = 0;
  const quickKey = () => { reads += 1; return 'quick-layout'; };
  const fullKey = () => 'full-layout';
  const quick = new ReaderSessionMorphSourceMeasurement('quickTts', 'quick', 0, 0, 135, 56, 12);
  const full = new ReaderSessionMorphSourceMeasurement('fullTtsPlayback', 'full', 0, 0, 140, 48, 13);
  assert.equal(owner.current('quickTts', quickKey), undefined);
  assert.equal(reads, 0);
  owner.admit(quick, quickKey);
  owner.admit(full, fullKey);
  assert.equal(owner.current('quickTts', quickKey), quick);
  assert.equal(reads, 2);
  assert.equal(owner.current('fullTtsPlayback', quickKey), undefined);
  assert.equal(owner.current('fullTtsPlayback', fullKey), full);
});
