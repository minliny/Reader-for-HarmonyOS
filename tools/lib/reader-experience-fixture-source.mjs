import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../../entry/src/main/ets/features/reading/', import.meta.url);
const body = file => readFileSync(new URL(file, root), 'utf8').replace(/^import[\s\S]*?;\s*/gm, '').replace(/^export /gm, '');

/** Declaration-fixture transport only: link the finite real production
 * modules at their former lexical seam. Never copy or substitute a model.
 * No SDK initialization, tests, subprocess or source mutation occurs here. */
export function readerExperienceDeclarationSource(source) {
  source ??= readFileSync(new URL('ui/LocalReadingExperience.ets', root), 'utf8');
  const models = body('presentation/ReaderPagePresentationModels.ets');
  const split = models.indexOf('interface ReaderControlPlaybackPresentation');
  assert.ok(split >= 0, 'actual presentation module exports playback seam');
  const linked = models.slice(0, split) + body('presentation/ReaderRetainedPresentationHost.ets') + '\n' + models.slice(split) +
    '\n' + body('application/ReadingMeasurementFacts.ts') + '\n' + body('ui/ReaderArkUILineMetric.ets');
  const marker = source.indexOf('type ReadingPhase =');
  assert.ok(marker >= 0, 'actual reader retains the phase declaration seam');
  return source.slice(0, marker) + linked + '\n' + source.slice(marker);
}

export function readReaderExperienceFixture(file, ...options) {
  const source = readFileSync(file, ...options);
  return typeof source === 'string' && String(file).endsWith('/LocalReadingExperience.ets') ?
    readerExperienceDeclarationSource(source) : source;
}
