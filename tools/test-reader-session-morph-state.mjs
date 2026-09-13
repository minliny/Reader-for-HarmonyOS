import assert from 'node:assert/strict';
import {
  readerSessionMorphActorId,
  readerSessionMorphSourceKindForPage,
  ReaderSessionMorphSourceMeasurement,
} from '../entry/src/main/ets/features/reading/ReaderSessionMorphState.ts';

assert.equal(readerSessionMorphSourceKindForPage('quickAutoPage'), 'quickAutoPage');
assert.equal(readerSessionMorphSourceKindForPage('moduleTts'), 'quickTts');
assert.equal(readerSessionMorphSourceKindForPage('fullAutoPage'), 'fullAutoPagePlayback');
assert.equal(readerSessionMorphSourceKindForPage('fullTts'), 'fullTtsPlayback');
assert.equal(readerSessionMorphSourceKindForPage('home'), undefined);
assert.equal(readerSessionMorphActorId('fullTtsPlayback'),
  'reader-session-morph-fullTtsPlayback');

console.log('reader session source identity: PASS');
