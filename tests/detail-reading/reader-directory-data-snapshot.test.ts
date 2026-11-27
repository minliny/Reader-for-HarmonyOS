import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { LocalReadingTocEntry } from '../../entry/src/main/ets/features/reading/application/LocalReadingFlowGateway.ts';
import { ReaderDirectoryDataPublication } from '../../entry/src/main/ets/features/reading/presentation/ReaderDirectoryDataSnapshot.ts';

test('an unchanged revision republishes 5,000 chapters without revisiting their values', () => {
  let valueReads = 0;
  const entries: LocalReadingTocEntry[] = Array.from({ length: 5_000 }, (_, index) => ({
    index, get title() { valueReads += 1; return `Chapter ${index}`; }, downloadState: 'unknown',
  }));
  const publication = new ReaderDirectoryDataPublication();
  const revision = publication.publish(entries, 1);
  const snapshot = publication.entriesAt(revision);
  valueReads = 0;

  for (let i = 0; i < 60; i += 1) assert.equal(publication.publish(entries, 1), revision);

  assert.equal(valueReads, 0);
  assert.equal(publication.entriesAt(revision), snapshot);
  assert.equal(snapshot.at(-1)?.title, 'Chapter 4999');
});

test('a revision change detects in-place edits and unversioned callers still compare values', () => {
  const entries: LocalReadingTocEntry[] = [{ index: 5, title: 'Old', downloadState: 'unknown' }];
  const publication = new ReaderDirectoryDataPublication();
  const initial = publication.publish(entries, 1);
  const previous = publication.entriesAt(initial);

  entries[0].title = 'Updated';
  assert.equal(publication.publish(entries, 2), initial + 1);
  assert.equal(previous[0].title, 'Old');
  assert.equal(publication.entriesAt(initial + 1)[0].title, 'Updated');

  entries[0].downloadState = 'cached';
  assert.equal(publication.publish(entries), initial + 2);
  assert.equal(publication.entriesAt(initial + 2)[0].downloadState, 'cached');
});
