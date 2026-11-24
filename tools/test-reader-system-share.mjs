import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { ReaderShareActions } from '../entry/src/main/ets/features/reading/application/ReaderShareActions.ts';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { resolveOpenHarmonySdkRoot } from './lib/tool-environment.mjs';

const hash = 'a'.repeat(64);
const local = { sourceId: 'local', bookId: `local:${hash}`, title: '长篇小说', author: '作者', kind: 'epub' };
const online = { sourceId: 'online', bookId: 'opaque', title: '小说', author: '作者', sourcePageUrl: 'https://example.org/book/7' };
const current = () => true;

function setup(options = {}) {
  const shown = [], copied = [];
  const port = {
    publicLink: value => value === online.sourcePageUrl ? value : undefined,
    ...options,
    show: async record => {
      shown.push(record);
      return options.show?.() ?? 'shown';
    },
  };
  const actions = new ReaderShareActions(port, text => copied.push(text));
  return { actions, shown, copied };
}

test('selection preserves the original text and presents the share panel', async () => {
  const { actions, shown, copied } = setup();
  const text = '  选文📚\n下一行';
  assert.equal(await actions.shareSelection(text, current), 'shown');
  assert.deepEqual(shown, [{ kind: 'text', text }]);
  assert.deepEqual(copied, []);
  assert.equal(await actions.shareSelection(text, current, true), 'copied');
  assert.equal(shown.length, 1, 'explicit copy for another app does not reopen the share sheet');
  assert.deepEqual(copied, [text]);
});

test('book information offers the existing legal link and falls back to metadata for other sources', async () => {
  const { actions, shown } = setup();
  await actions.shareBook(online, current);
  await actions.shareBook({ ...online, sourcePageUrl: 'file:///private' }, current);
  await actions.shareBook(local, current);
  assert.deepEqual(shown, [
    { kind: 'link', text: online.sourcePageUrl, title: '小说', description: '作者' },
    { kind: 'text', text: '小说\n作者', title: '小说' },
    { kind: 'text', text: '长篇小说\n作者', title: '长篇小说' },
  ]);
});

test('an admitted local book requests its own retained original and never exposes its path in a fallback', async () => {
  const { actions, shown, copied } = setup({ show: () => 'unavailable' });
  const path = `/sandbox/files/reader-import/books/${hash}.source`;
  assert.equal(await actions.shareFile(local, async id => {
    assert.equal(id, local.bookId);
    return path;
  }, current), 'fileCopied');
  assert.deepEqual(shown, [{ kind: 'file', path, hash, extension: '.epub', title: '长篇小说' }]);
  assert.deepEqual(copied, ['长篇小说\n作者']);
  assert.equal(await actions.shareFile({ ...local, bookId: 'local:../reader-core.sqlite3' },
    async () => assert.fail('untrusted identity must not reach file lookup'), current), 'unsafeFile');
});

test('unavailable or rejected platform sharing copies once while dismissal has no side effects', async () => {
  const rejected = setup({ show: () => { throw Error('unsupported'); } });
  assert.equal(await rejected.actions.shareBook(online, current), 'copied');
  assert.deepEqual(rejected.copied, ['小说\n作者\nhttps://example.org/book/7']);
  const dismissed = setup({ show: () => 'dismissed' });
  assert.equal(await dismissed.actions.shareSelection('选文', current), 'dismissed');
  assert.deepEqual(dismissed.copied, []);
});

test('a retired entity cannot open a late panel or overwrite the clipboard', async () => {
  let active = true;
  const retired = setup({ show: () => { active = false; return 'unavailable'; } });
  assert.equal(await retired.actions.shareSelection('旧选文', () => active), 'retired');
  assert.deepEqual(retired.copied, []);
  active = true;
  assert.equal(await retired.actions.shareFile(local, async () => { active = false; return '/safe'; }, () => active), 'retired');
  assert.equal(retired.shown.length, 1);
});

const platformSource = readFileSync(new URL('../entry/src/main/ets/platform/share/ReaderSystemShareHost.ts', import.meta.url), 'utf8');
const filesDir = '/sandbox/files';
const booksDir = `${filesDir}/reader-import/books`;
const cacheDir = '/sandbox/app-cache';
const shareCache = `${cacheDir}/reader-share`;
const shareDirectory = `${shareCache}/book-abcdef`;
const original = { kind: 'file', path: `${booksDir}/${hash}.source`, hash, extension: '.epub', title: local.title };
const textUtd = 'general.plain-text';
const linkUtd = 'general.hyperlink';
const fileUtd = 'general.file';
const epubUtd = 'general.epub';

function platformSetup({ available = true, hasContext = true, symlink, rejectShow = false, extensionUtd = epubUtd,
  copyFile = () => {} } = {}) {
  const lstatPaths = [], copies = [], removed = [], uriPaths = [], utdRequests = [], panelLaunches = [];
  const listeners = new Map();
  const context = { filesDir, getApplicationContext: () => ({ cacheDir }) };
  class SharedData {
    constructor(record) { this.record = record; }
  }
  class ShareController {
    constructor(data) { this.data = data; }
    on(event, listener) { listeners.set(event, listener); }
    off(event, listener) {
      if (listeners.get(event) === listener) listeners.delete(event);
    }
    async show(abilityContext, options) {
      assert.equal(abilityContext, context);
      panelLaunches.push({ record: this.data.record, ...options });
      if (rejectShow) throw new Error('Share Kit rejected the record');
    }
  }
  const { ReaderSystemShareHost } = pureModuleProbe(platformSource, 'ReaderSystemShareHost.ts', {
    url: { URL: { parseURL: value => {
      const parsed = new URL(value);
      return Object.assign(parsed, { params: parsed.searchParams });
    } } },
    canIUse: feature => {
      assert.equal(feature, 'SystemCapability.Collaboration.SystemShare');
      return available;
    },
    uniformTypeDescriptor: {
      UniformDataType: { PLAIN_TEXT: textUtd, HYPERLINK: linkUtd, FILE: fileUtd },
      getUniformDataTypeByFilenameExtension(extension, base) {
        utdRequests.push([extension, base]);
        // TXT and EPUB descend from general.object, not general.file.
        return base === fileUtd ? 'flex.dynamic-file-type' : extensionUtd;
      },
    },
    fileIo: {
      async access(path) { assert.equal(path, shareCache); return path === symlink; },
      async lstat(path) {
        lstatPaths.push(path);
        return { isDirectory: () => path !== symlink && [booksDir, `${filesDir}/reader-import`, shareCache, shareDirectory].includes(path),
          isSymbolicLink: () => path === symlink, isFile: () => path !== symlink && /\.(source|epub)$/.test(path) };
      },
      async mkdir(path) { assert.equal(path, shareCache); },
      async listFile(path) { assert.equal(path, shareCache); return []; },
      async mkdtemp(template) { assert.equal(template, `${shareCache}/book-XXXXXX`); return shareDirectory; },
      async copyFile(source, destination) { copies.push([source, destination]); copyFile(); },
      async rmdir(path) { removed.push(path); },
    },
    fileUri: {
      getUriFromPath(path) {
        uriPaths.push(path);
        return `file://io.reader.minliny${path}`;
      },
    },
    systemShare: { ShareController, SharedData, SelectionMode: { SINGLE: 0 } },
  }, ['ReaderSystemShareHost']);
  const host = new ReaderSystemShareHost(() => hasContext ? context : undefined, 'share-button');
  function emit(event, result) {
    const callback = listeners.get(event);
    assert.ok(callback, `ShareController has a ${event} listener`);
    callback(result);
    assert.equal(listeners.size, 0, 'terminal event removes both listeners');
  }
  return { host, lstatPaths, copies, removed, uriPaths, utdRequests, panelLaunches, listeners, emit };
}

test('SDK-emitted adapter publishes text and validates public links before handing them to Share Kit', async () => {
  const platform = platformSetup();
  const { host, panelLaunches, emit } = platform;
  const text = '选文📚\n下一行';
  const excerpt = host.show({ kind: 'text', text }, current);
  assert.deepEqual(panelLaunches.at(-1), { record: { utd: textUtd, content: text, title: undefined, description: undefined },
    selectionMode: 0, anchor: 'share-button' });
  emit('shareCompleted', { targetAbilityInfo: { name: 'recipient' } });
  assert.equal(await excerpt, 'shown');

  const link = host.publicLink('  HTTPS://Example.org/book/7?q=chapter#title  ');
  assert.equal(link, 'https://example.org/book/7?q=chapter#title');
  const credentialLink = new URL('https://example.org/book');
  credentialLink.password = 'reader-fixture';
  for (const unsafe of ['javascript:alert(1)', 'file:///private/reader.sqlite3', 'https://', 'https://[::1',
    'https://user@example.org/book', credentialLink.toString(), 'https://example.org/a\\b', 'https://exa mple.org',
    'https://example.org/a\r\nb', 'https://example.org/book?access_token=fixture',
    'https://example.org/book#session=fixture', 'https://example.org/book?X-Amz-Signature=fixture', 'https://example.org/book,{"method":"POST"}']) {
    assert.equal(host.publicLink(unsafe), undefined);
  }
  const bookLink = host.show({ kind: 'link', text: link, title: online.title, description: online.author }, current);
  assert.deepEqual(panelLaunches.at(-1).record, { utd: linkUtd, content: link, title: online.title, description: online.author });
  emit('shareCompleted', { targetAbilityInfo: { name: 'recipient' } });
  assert.equal(await bookLink, 'shown');
});

test('SDK-emitted adapter converts only a checked retained original to a file URI and supplies its UTD', async () => {
  for (const [extension, extensionUtd] of [['.epub', epubUtd], ['.txt', textUtd], ['.epub', ''], ['.epub', 'flex.dynamic-ebook']]) {
    const platform = platformSetup({ extensionUtd });
    const record = { ...original, extension, path: extensionUtd === '' ? `${booksDir}/${hash}.epub` : original.path,
      title: extension === '.txt' ? '../上卷\\章\u0000名' : original.title };
    const sharing = platform.host.show(record, current);
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(platform.lstatPaths.slice(0, 3), [`${filesDir}/reader-import`, booksDir, record.path]);
    assert.equal(platform.copies.length, 1);
    const [source, stagedPath] = platform.copies[0];
    assert.equal(source, record.path);
    const filename = stagedPath.slice(shareDirectory.length + 1);
    assert.ok(stagedPath.startsWith(`${shareDirectory}/`));
    assert.ok(filename.endsWith(extension), 'the receiving app gets the original format suffix');
    assert.doesNotMatch(filename, /[\\/\u0000-\u001f]/, 'book metadata cannot escape the scoped share directory');
    assert.deepEqual(platform.uriPaths, [stagedPath]);
    assert.deepEqual(platform.panelLaunches.at(-1).record, {
      utd: extensionUtd && !extensionUtd.startsWith('flex.') ? extensionUtd : fileUtd, uri: `file://io.reader.minliny${stagedPath}`, title: record.title,
    });
    assert.deepEqual(platform.utdRequests.map(([requested]) => requested), [extension]);
    platform.emit('shareCompleted', { targetAbilityInfo: { name: 'recipient' } });
    assert.equal(await sharing, 'shown');
  }
});

test('SDK-emitted adapter refuses private database paths, traversal, mismatched identity, and archive symlinks', async () => {
  const platform = platformSetup();
  for (const record of [{ ...original, path: `${filesDir}/reader.sqlite3` },
    { ...original, path: `${booksDir}/../../reader.sqlite3` },
    { ...original, path: `${booksDir}-elsewhere/${hash}.source` },
    { ...original, hash: 'b'.repeat(64) }, { ...original, hash: '../reader.sqlite3' },
    { ...original, extension: '.sqlite3' }]) {
    assert.equal(await platform.host.show(record, current), 'unsafe');
  }
  assert.deepEqual(platform.lstatPaths, [], 'lexical checks run before any filesystem work');
  assert.deepEqual(platform.copies, []);
  assert.deepEqual(platform.uriPaths, []);
  assert.deepEqual(platform.panelLaunches, []);

  for (const symlink of [`${filesDir}/reader-import`, booksDir, original.path, shareCache]) {
    const linked = platformSetup({ symlink });
    assert.equal(await linked.host.show(original, current), 'unsafe');
    assert.equal(linked.lstatPaths.at(-1), symlink, 'traversal stops at the symlink');
    assert.deepEqual(linked.copies, []);
    assert.deepEqual(linked.uriPaths, []);
    assert.deepEqual(linked.panelLaunches, []);
  }
});

test('SDK-emitted adapter removes failed or retired staged copies without sharing the archive', async () => {
  for (const outcome of ['failed', 'retired']) {
    let active = true;
    const platform = platformSetup({ copyFile() {
      if (outcome === 'failed') throw new Error('cache full');
      active = false;
    } });
    const copied = [];
    const actions = new ReaderShareActions(platform.host, text => copied.push(text));
    assert.equal(await actions.shareFile(local, async () => original.path, () => active),
      outcome === 'failed' ? 'fileCopied' : 'retired');
    assert.equal(platform.copies.length, 1);
    assert.deepEqual(platform.removed, [shareDirectory]);
    assert.deepEqual(platform.uriPaths, []);
    assert.deepEqual(platform.panelLaunches, []);
    assert.deepEqual(copied, outcome === 'failed' ? ['长篇小说\n作者'] : []);
  }
});

test('SDK-emitted adapter falls back on explicit launch rejection and keeps dismissal neutral', async () => {
  for (const options of [{ available: false }, { hasContext: false }, { rejectShow: true }]) {
    const platform = platformSetup(options);
    const copied = [];
    const actions = new ReaderShareActions(platform.host, text => copied.push(text));
    assert.equal(await actions.shareSelection('选文', current), 'copied');
    assert.deepEqual(copied, ['选文']);
    assert.equal(platform.panelLaunches.length, options.rejectShow === true ? 1 : 0);
    assert.equal(platform.listeners.size, 0);
  }

  const platform = platformSetup();
  const copied = [];
  const actions = new ReaderShareActions(platform.host, text => copied.push(text));
  const sharing = actions.shareSelection('选文', current);
  platform.emit('dismiss');
  assert.equal(await sharing, 'dismissed');
  assert.deepEqual(copied, []);
});

test('the app profile grants only read access to the dedicated share cache directory', () => {
  const readJson = path => JSON.parse(readFileSync(new URL(`../entry/src/main/${path}`, import.meta.url), 'utf8'));
  const module = readJson('module.json5').module;
  assert.equal(module.shareFiles, '$profile:reader_share_files');
  const profile = readJson('resources/base/profile/reader_share_files.json');
  assert.deepEqual(profile, { share_files: { scopes: [{ path: '/el2/base/cache/reader-share', permission: 'r' }] } });
  const sdk = resolveOpenHarmonySdkRoot();
  const require = createRequire(import.meta.url);
  const Ajv = require(`${sdk}/ets/build-tools/ets-loader/node_modules/ajv`);
  const schema = JSON.parse(readFileSync(`${sdk}/toolchains/modulecheck/shareFiles.json`, 'utf8'));
  const validator = new Ajv({ strict: false });
  assert.ok(validator.validate(schema, profile), JSON.stringify(validator.errors));
});

test('the SDK-emitted detail buttons invoke their own actions and retire with the presented book', async () => {
  const { localBookDetailSdk } = await import('./lib/local-book-detail-sdk-probe.mjs');
  const { shown, copied, actions } = setup({ show: () => 'unavailable' });
  const { Component } = localBookDetailSdk({
    readerSystemShareActions: () => actions,
    readerShareMessage: result => ['fileCopied', 'copied'].includes(result) ? result : undefined,
  });
  const owner = new Component(undefined, {});
  const feedback = [];
  Object.assign(owner, {
    book: { ...local, kind: 'local', contentKind: 'text' }, mounted: true, inBookshelf: true, directoryFocusContext: 'detail',
    isDetailActionCurrent: current,
    retainedShareFile: async () => original.path,
    transientFeedback: { reset() {}, show(_context, options, admitted) { if (admitted()) feedback.push(options.message); } },
  });
  owner.shareActions();
  const click = id => {
    const button = [...owner.nodes.values()].find(node => node.id === `reader-detail-share-${id}`);
    assert.ok(button?.onClick, `real detail ${id} Button`);
    button.onClick();
  };
  click('book');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(shown[0].text, '长篇小说\n作者');
  click('file');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(shown[1].kind, 'file');
  assert.equal(shown[1].extension, '.txt', 'ordinary TXT imports use the historical local kind');
  click('copy');
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(feedback, ['copied', 'fileCopied', 'copied']);
  assert.deepEqual(copied, ['长篇小说\n作者', '长篇小说\n作者', '长篇小说\n作者']);
  let release, lookups = 0;
  owner.retainedShareFile = () => { lookups++; return new Promise(resolve => { release = resolve; }); };
  click('file');
  click('file');
  assert.equal(lookups, 1, 'one file share attempt per detail presentation');
  owner.directoryFocusContext = 'directory';
  owner.directoryFocusContext = 'detail';
  release(original.path);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(shown.length, 2, 'returning to the same book does not revive a retired share');
  owner.isDetailActionCurrent = () => false;
  click('file');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(shown.length, 2, 'hidden detail cannot dispatch a retained action');
});
