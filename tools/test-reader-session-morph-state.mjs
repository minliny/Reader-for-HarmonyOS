import assert from 'node:assert/strict';
import {
  createReaderSessionMorphGeometry,
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

const source = new ReaderSessionMorphSourceMeasurement(
  'quickAutoPage', readerSessionMorphActorId('quickAutoPage'), 20, 500, 286, 196, 1,
);
const geometry = createReaderSessionMorphGeometry(source, 360, 790, 96);
assert.ok(geometry !== undefined);
assert.deepEqual({
  sourceLeft: geometry.sourceLeft,
  sourceTop: geometry.sourceTop,
  sourceWidth: geometry.sourceWidth,
  sourceHeight: geometry.sourceHeight,
  sourceCenterX: geometry.sourceCenterX,
  sourceCenterY: geometry.sourceCenterY,
  dotCenterX: geometry.dotCenterX,
  dotCenterY: geometry.dotCenterY,
  dotScaleX: geometry.dotScaleX,
  dotScaleY: geometry.dotScaleY,
  capsuleWidth: geometry.capsuleWidth,
}, {
  sourceLeft: 20,
  sourceTop: 500,
  sourceWidth: 286,
  sourceHeight: 196,
  sourceCenterX: 163,
  sourceCenterY: 598,
  dotCenterX: 360,
  dotCenterY: 790,
  dotScaleX: 24 / 286,
  dotScaleY: 24 / 196,
  capsuleWidth: 96,
});
assert.equal(createReaderSessionMorphGeometry(
  new ReaderSessionMorphSourceMeasurement('quickTts', 'bad', 0, 0, 0, 190, 1), 1, 1, 94,
), undefined);
assert.equal(createReaderSessionMorphGeometry(source, 1, 1, 20), undefined);

console.log('reader session morph state: PASS');
