import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ReaderContentBusinessGateway } from
  '../entry/src/main/ets/features/reading/ReaderContentBusinessGateway.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const calls = [];
const gateway = new ReaderContentBusinessGateway({
  async request(method, params) {
    calls.push({ method, params });
    if (method === 'content-edit.get') {
      return {
        data: {
          edit: {
            editId: 7,
            sourceId: 'source-a',
            bookId: 'book-a',
            chapterIndex: 2,
            editedContent: 'saved body',
            editedAt: 100,
          },
        },
      };
    }
    if (method === 'content-edit.put') {
      return {
        data: {
          edit: {
            editId: 7,
            sourceId: params.sourceId,
            bookId: params.bookId,
            chapterIndex: params.chapterIndex,
            editedContent: params.editedContent,
            editedAt: params.editedAt,
          },
        },
      };
    }
    if (method === 'content-edit.delete') {
      return { data: { deleted: 1 } };
    }
    if (method === 'book.chapterReview') {
      return {
        data: {
          sourceId: params.sourceId,
          bookId: params.bookId,
          reviews: [{
            author: '张三',
            content: '值得一读',
            postTime: '2026-08-12',
            rating: '5',
            reviewUrl: params.chapterUrl,
          }],
        },
      };
    }
    throw new Error(`unexpected method ${method}`);
  },
});

const edit = await gateway.loadEdit('source-a', 'book-a', 2);
assert.equal(edit?.editId, 7);
const saved = await gateway.saveEdit('source-a', 'book-a', 2, 'new body');
assert.equal(saved.editedContent, 'new body');
await gateway.deleteEdit(7);
const reviews = await gateway.loadChapterReviews('source-a', 'book-a', 'https://fixture/chapter/2');
assert.equal(reviews.length, 1);
assert.equal(reviews[0].author, '张三');
assert.equal(calls.at(-1).params.reviewUrl, 'https://fixture/chapter/2',
  'the exact TOC URL must be the Core-owned review fetch boundary');
const beforeLocal = calls.length;
await assert.rejects(
  gateway.loadChapterReviews('local', 'book-a', 'file:///chapter/2'),
  /local books/,
);
assert.equal(calls.length, beforeLocal, 'local review must fail closed before Core/network work');
await assert.rejects(
  gateway.saveEdit('source-a', 'book-a', 2, '   '),
  /must not be blank/,
);

const sessionSource = fs.readFileSync(path.join(root,
  'entry/src/main/ets/features/reading/ReadingChapterWindow.ts'), 'utf8');
const remoteSource = fs.readFileSync(path.join(root,
  'entry/src/main/ets/features/reading/RemoteReadingFlowGateway.ts'), 'utf8');
const controlSource = fs.readFileSync(path.join(root,
  'entry/src/main/ets/features/reading/ReaderControlPanel.ets'), 'utf8');
const experienceSource = fs.readFileSync(path.join(root,
  'entry/src/main/ets/features/reading/LocalReadingExperience.ets'), 'utf8');

assert.match(sessionSource, /readonly chapterUrl: string \| undefined/);
assert.match(sessionSource, /chapterUrl: chapter\.chapterUrl/,
  'bounded chapter copies must retain the exact URL');
assert.match(remoteSource, /chapterUrl: selected\.url/,
  'remote materialization must carry the TOC URL into chapter tools');
assert.match(controlSource, /onMore: \(\) => void/);
assert.match(controlSource, /accessibilityText\('正文工具'\)[\s\S]*onMore\(\)/,
  'the formerly disabled More action must expose the product entry');
assert.doesNotMatch(controlSource, /margin\(\{ left: 8\s*\}\)[\s\S]{0,80}enabled\(false\)[\s\S]{0,80}accessibilityText\('更多'\)/);
assert.match(experienceSource, /content-edit\.put|saveContentBusinessEdit/);
assert.match(experienceSource, /content-edit\.delete|restoreContentBusinessOriginal/);
assert.match(experienceSource, /reloadCurrentPageAfterContentMutation/,
  'save/delete must invalidate the materialized page and reload through Core');
assert.match(experienceSource, /reviewsEnabled: this\.sourceId !== LOCAL_READING_SOURCE_ID/);

console.log('reader content business: PASS');
