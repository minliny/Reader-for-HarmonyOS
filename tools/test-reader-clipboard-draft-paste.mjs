import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';
import { selectedProductionMethods } from './lib/selected-production-methods.mjs';

const adapter = readFileSync(new URL('../entry/src/main/ets/platform/clipboard/ReaderClipboardHost.ts', import.meta.url), 'utf8')
  .replace(/^import .*;\n/m, '').replace(/^export /gm, '');

function fixture(getData) {
  let reads = 0;
  const pasteboard = {
    getSystemPasteboard: () => ({
      getData() {
        reads += 1;
        return getData();
      },
    }),
  };
  const makePaste = new Function('pasteboard', stripTypeScriptTypes(adapter) + '\nreturn new ReaderClipboardDraftPaste();');
  const owner = makePaste(pasteboard);
  const text = [];
  const problems = [];
  return {
    owner, text, problems, reads: () => reads,
    paste: (authorized, current = () => true) => owner.paste(authorized, current,
      value => text.push(value), problem => problems.push(problem)),
  };
}

test('an unauthorized click or a retired surface never reads clipboard content', async () => {
  const state = fixture(() => { assert.fail('clipboard read without admission'); });
  await state.paste(false);
  await state.paste(true, () => false);
  assert.equal(state.reads(), 0);
  assert.deepEqual(state.text, []);
  assert.deepEqual(state.problems, ['denied']);
});

test('an authorized read preserves the exact draft and reports empty and failed reads distinctly', async () => {
  const draft = '  {"名字":"我的书源"}\n';
  const state = fixture(() => ({ getPrimaryText: () => draft }));
  await state.paste(true);
  assert.deepEqual(state.text, [draft]);
  assert.deepEqual(state.problems, []);

  for (const value of [undefined, '', ' \n ']) {
    const empty = fixture(() => ({ getPrimaryText: () => value }));
    await empty.paste(true);
    assert.deepEqual(empty.problems, ['empty']);
    assert.deepEqual(empty.text, []);
  }

  const failed = fixture(() => { throw Error('platform clipboard unavailable'); });
  await failed.paste(true);
  assert.deepEqual(failed.problems, ['failed']);
  assert.deepEqual(failed.text, []);
});

test('late reads cannot overwrite a newer paste or republish feedback for a retired draft', async () => {
  const replies = [];
  const state = fixture(() => new Promise((resolve, reject) => replies.push({ resolve, reject })));
  const old = state.paste(true);
  const current = state.paste(true);
  replies[1].resolve({ getPrimaryText: () => 'current' });
  await current;
  replies[0].resolve({ getPrimaryText: () => 'old' });
  await old;
  assert.deepEqual(state.text, ['current']);

  const retired = state.paste(true);
  state.owner.retire();
  replies[2].reject(Error('late error'));
  await retired;
  assert.deepEqual(state.problems, []);

  let currentSurface = true;
  const detached = state.paste(true, () => currentSurface);
  currentSurface = false;
  replies[3].resolve({ getPrimaryText: () => 'detached' });
  await detached;
  assert.deepEqual(state.text, ['current']);
});

test('source transfer routes paste to the active URL or JSON draft without running the import', async () => {
  const replies = [];
  const state = fixture(() => new Promise(resolve => replies.push(resolve)));
  const Type = selectedProductionMethods(new URL('../entry/src/main/ets/features/source/ui/SourceV9TransferPage.ets', import.meta.url),
    'SourceV9TransferPage', ['onPasteDraft', 'canPasteDraft', 'setPasteDraft', 'retireClipboardPaste'], {
      PasteButtonOnClickResult: { SUCCESS: 0 },
      readerClipboardPasteMessage: problem => problem,
    });
  const page = new Type();
  const feedback = [];
  Object.assign(page, {
    draftPaste: state.owner, transientFeedback: { show: (_context, options) => feedback.push(options.message) },
    foreground: true, pane: 'import', origin: 'url', dialog: 'none', state: { importStep: 1 }, editable: () => true,
    url: 'original URL', paste: 'original JSON', formUrl: 'original subscription',
    flow: new Proxy({}, { get: () => assert.fail('paste attempted to dispatch to the import owner') }),
  });
  page.onPasteDraft('url', 1);
  assert.deepEqual(feedback, ['denied']);
  assert.equal(state.reads(), 0);
  assert.equal(page.url, 'original URL');

  page.onPasteDraft('url', 0);
  page.origin = 'paste';
  replies[0]({ getPrimaryText: () => 'stale URL' });
  await Promise.resolve();
  assert.equal(page.url, 'original URL');
  assert.equal(page.paste, 'original JSON');

  page.onPasteDraft('paste', 0);
  replies[1]({ getPrimaryText: () => ' \n ' });
  await Promise.resolve();
  assert.equal(page.paste, 'original JSON');
  assert.deepEqual(feedback, ['denied', 'empty']);

  page.onPasteDraft('paste', 0);
  const json = '  {"名字":"我的书源"}\n';
  replies[2]({ getPrimaryText: () => json });
  await Promise.resolve();
  assert.equal(page.paste, json);
  assert.equal(page.url, 'original URL');

  page.origin = 'url';
  page.onPasteDraft('url', 0);
  page.setPasteDraft('url', 'new manual URL');
  replies[3]({ getPrimaryText: () => 'outdated clipboard URL' });
  await Promise.resolve();
  assert.equal(page.url, 'new manual URL');

  page.onPasteDraft('url', 0);
  replies[4]({ getPrimaryText: () => '  https://example.test/clipboard.json  ' });
  await Promise.resolve();
  assert.equal(page.url, '  https://example.test/clipboard.json  ');
  assert.equal(page.paste, json);

  page.pane = 'subscriptions';
  page.dialog = 'form';
  page.onPasteDraft('subscriptionUrl', 0);
  replies[5]({ getPrimaryText: () => 'https://example.test/subscription.json' });
  await Promise.resolve();
  assert.equal(page.formUrl, 'https://example.test/subscription.json');
});
