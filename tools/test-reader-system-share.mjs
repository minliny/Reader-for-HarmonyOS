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

test('quote cards share an exported PNG and fall back to the complete original selection', async () => {
  const text = '  选文📚\n下一行';
  const path = '/sandbox/app-cache/reader-share/quote-abcdef/quote.png';
  const released = [];
  const render = async () => ({ path, release: async () => released.push(path) });
  const shown = setup();
  assert.equal(await shown.actions.shareQuoteCard(text, '书名', render, current), 'shown');
  assert.deepEqual(shown.shown, [{ kind: 'image', path, title: '书名' }]);
  assert.deepEqual(released, []);
  for (const result of ['unavailable', 'unsafe', 'dismissed', 'throw']) {
    const platform = setup({ show: () => { if (result === 'throw') throw Error('platform'); return result; } });
    assert.equal(await platform.actions.shareQuoteCard(text, '书名', render, current),
      result === 'dismissed' ? 'dismissed' : 'quoteCopied');
    assert.deepEqual(platform.copied, result === 'dismissed' ? [] : [text]);
    assert.deepEqual(released.splice(0), [path]);
  }
  const unavailable = setup({ show: () => 'unavailable' });
  assert.equal(await unavailable.actions.shareQuoteCard(text, '书名', async () => { throw Error('snapshot'); }, current), 'quoteCopied');
  assert.deepEqual(unavailable.copied, [text]);
});

test('a quote built for a retired selection never launches the sheet or replaces clipboard contents', async () => {
  const { actions, shown, copied } = setup();
  let active = true;
  let released = 0;
  assert.equal(await actions.shareQuoteCard('旧内容', '书名', async () => {
    active = false;
    return { path: 'late', release: async () => { released++; } };
  }, () => active), 'retired');
  assert.equal(released, 1);
  assert.deepEqual(shown, []);
  assert.deepEqual(copied, []);
  active = true;
  const handedOff = setup({ show: () => { active = false; return 'shown'; } });
  assert.equal(await handedOff.actions.shareQuoteCard('旧内容', '书名', async () => ({
    path: 'already-handed-off', release: async () => { released++; },
  }), () => active), 'retired');
  assert.equal(released, 1);
  assert.deepEqual(handedOff.copied, []);
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
const quoteDirectory = `${shareCache}/quote-abcdef`;
const original = { kind: 'file', path: `${booksDir}/${hash}.source`, hash, extension: '.epub', title: local.title };
const textUtd = 'general.plain-text';
const linkUtd = 'general.hyperlink';
const fileUtd = 'general.file';
const epubUtd = 'general.epub';
const pngUtd = 'general.png';

function platformSetup({ available = true, hasContext = true, symlink, rejectShow = false, rejectController = false,
  extensionUtd = epubUtd, copyFile = () => {}, getUri = () => {}, cacheEntries = [], quoteSize = 42 } = {}) {
  const lstatPaths = [], copies = [], removed = [], uriPaths = [], utdRequests = [], panelLaunches = [];
  const listeners = new Map();
  const context = { filesDir, getApplicationContext: () => ({ cacheDir }) };
  class SharedData {
    constructor(record) { this.record = record; }
  }
  class ShareController {
    constructor(data) {
      if (rejectController) throw new Error('Share Kit could not create a controller');
      this.data = data;
    }
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
      UniformDataType: { PLAIN_TEXT: textUtd, HYPERLINK: linkUtd, FILE: fileUtd, PNG: pngUtd },
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
        const entry = cacheEntries.find(item => path === `${shareCache}/${item.name}`);
        return { isDirectory: () => path !== symlink && ([booksDir, `${filesDir}/reader-import`, shareCache,
          shareDirectory, quoteDirectory].includes(path) || entry !== undefined),
          isSymbolicLink: () => path === symlink, isFile: () => path !== symlink && /\.(source|epub|png)$/.test(path),
          mtime: entry?.mtime, size: quoteSize };
      },
      async mkdir(path) { assert.equal(path, shareCache); },
      async listFile(path) { assert.equal(path, shareCache); return cacheEntries.map(item => item.name); },
      async mkdtemp(template) { assert.equal(template, `${shareCache}/book-XXXXXX`); return shareDirectory; },
      async copyFile(source, destination) { copies.push([source, destination]); copyFile(); },
      async rmdir(path) { removed.push(path); },
    },
    fileUri: {
      getUriFromPath(path) {
        uriPaths.push(path);
        getUri();
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

test('SDK-emitted adapter shares only a bounded PNG in the dedicated quote directory', async () => {
  const path = `${quoteDirectory}/quote.png`;
  const platform = platformSetup();
  const sharing = platform.host.show({ kind: 'image', path, title: '书名' }, current);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(platform.panelLaunches.at(-1).record, { utd: pngUtd, uri: `file://io.reader.minliny${path}`, title: '书名' });
  platform.emit('shareCompleted', {});
  assert.equal(await sharing, 'shown');
  for (const rejected of [{ path: `${shareDirectory}/quote.png` }, { path: `${quoteDirectory}/../quote.png` },
    { path: `${filesDir}/quote.png` }, { path, options: { quoteSize: 0 } },
    { path, options: { quoteSize: 8 * 1024 * 1024 + 1 } }, { path, options: { symlink: quoteDirectory } }]) {
    const candidate = platformSetup(rejected.options);
    assert.equal(await candidate.host.show({ kind: 'image', path: rejected.path, title: '书名' }, current), 'unsafe');
    assert.deepEqual(candidate.uriPaths, []);
    assert.deepEqual(candidate.panelLaunches, []);
  }
});

test('the shared 24-hour cache cleanup expires only old book and quote directories', async () => {
  const now = Date.now() / 1000;
  const platform = platformSetup({ cacheEntries: [
    { name: 'book-expire', mtime: now - 86401 }, { name: 'quote-expire', mtime: now - 86401 },
    { name: 'quote-recent', mtime: now - 86399 }, { name: 'other-expire', mtime: now - 86401 },
  ] });
  const sharing = platform.host.show(original, current);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(platform.removed, [`${shareCache}/book-expire`, `${shareCache}/quote-expire`]);
  platform.emit('dismiss');
  assert.equal(await sharing, 'dismissed');
});

test('quote export bounds Unicode and pixels and retains only a request-current PNG', async () => {
  const source = readFileSync(new URL('../entry/src/main/ets/features/reading/ui/ReaderQuoteCardExporter.ets', import.meta.url), 'utf8');
  const platformSource = source.slice(0, source.indexOf('@Builder')) + source.slice(source.indexOf('export async function'));
  for (const retirement of ['none', 'during-pack']) {
    let active = true;
    let model;
    const events = [];
    const pixelMap = {
      async getImageInfo() { return { size: { width: 900, height: 1440 } }; },
      async release() { events.push('release-pixel'); },
    };
    const { exportReaderQuoteCard } = pureModuleProbe(platformSource, 'ReaderQuoteCardExporter.ets', {
      readerQuoteCard() {},
      wrapBuilder: builder => builder,
      readerAppearanceSnapshotFontFamily: () => 'Reader Serif',
      readerAppearanceThemeStyle: () => ({ paperStart: '#f5ebd6', paperEnd: '#f2e6c9', ink: '#292718' }),
      prepareReaderFontFamily: async font => assert.equal(font, 'Reader Serif'),
      ComponentContent: class {
        constructor(_ui, _build, actual) { model = actual; }
        dispose() { events.push('dispose'); }
      },
      READER_QUOTE_CARD_MAX_BYTES: 8 * 1024 * 1024,
      createReaderShareCopy: async (_context, kind) => { assert.equal(kind, 'quote'); return quoteDirectory; },
      removeReaderShareCopy: async path => events.push(['remove', path]),
      fileIo: {
        OpenMode: { WRITE_ONLY: 1, CREATE: 64, NOFOLLOW: 0o400000 },
        async open(path) { assert.equal(path, `${quoteDirectory}/quote.png`); return { fd: 8 }; },
        async stat() { return { size: 12000 }; },
        async fsync() { events.push('fsync'); },
        async close() { events.push('close'); },
      },
      image: {
        createImagePacker: () => ({
          async packToFile(map, fd, options) {
            assert.equal(map, pixelMap);
            assert.equal(fd, 8);
            assert.deepEqual(options, { format: 'image/png', quality: 100 });
            if (retirement === 'during-pack') active = false;
          },
          async release() { events.push('release-packer'); },
        }),
      },
    }, ['exportReaderQuoteCard']);
    const ui = {
      getHostContext: () => ({}),
      vp2px: value => value * 3,
      getComponentSnapshot: () => ({
        async createFromComponent(_content, delay, shouldCheckImageStatus, options) {
          assert.equal(delay, 0);
          assert.equal(shouldCheckImageStatus, true);
          assert.deepEqual(options, { scale: 1440 / 1860, waitUntilRenderFinished: true });
          return pixelMap;
        },
      }),
    };
    const result = await exportReaderQuoteCard(ui, '📚'.repeat(400), ' 书名 ', ' 作者 ', { activeTheme: 'paper' }, () => active);
    assert.equal(model.text, `${'📚'.repeat(260)}…`);
    assert.deepEqual([model.title, model.author, model.style.ink, model.font], ['书名', '作者', '#292718', 'Reader Serif']);
    assert.equal(result?.path, retirement === 'none' ? `${quoteDirectory}/quote.png` : undefined);
    assert.deepEqual(events, [
      ...(retirement === 'none' ? ['fsync', 'close'] : ['close', ['remove', quoteDirectory]]),
      'release-packer', 'release-pixel', 'dispose',
    ]);
    if (result !== undefined) {
      await result.release();
      assert.deepEqual(events.at(-1), ['remove', quoteDirectory]);
    }
  }
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
    assert.equal(platform.listeners.size, 0);
    assert.deepEqual(platform.removed, []);
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

test('SDK-emitted adapter removes only its own book copy after rejection, dismissal or retirement before launch', async () => {
  for (const outcome of ['rejectShow', 'rejectController', 'dismissed', 'retired']) {
    let active = true;
    const platform = platformSetup({
      rejectShow: outcome === 'rejectShow', rejectController: outcome === 'rejectController',
      getUri: () => { if (outcome === 'retired') active = false; },
    });
    const copied = [];
    const actions = new ReaderShareActions(platform.host, text => copied.push(text));
    const sharing = actions.shareFile(local, async () => original.path, () => active);
    if (outcome === 'dismissed') {
      await new Promise(resolve => setImmediate(resolve));
      assert.deepEqual(platform.removed, []);
      platform.emit('dismiss');
    }
    assert.equal(await sharing, outcome.startsWith('reject') ? 'fileCopied' : outcome);
    assert.deepEqual(platform.copies, [[original.path, `${shareDirectory}/${local.title}.epub`]]);
    assert.deepEqual(platform.removed, [shareDirectory]);
    assert.equal(platform.listeners.size, 0);
  }
});

test('a sharing completion reported immediately after dismissal keeps the handed-off book copy', async () => {
  const platform = platformSetup();
  const sharing = platform.host.show(original, current);
  await new Promise(resolve => setImmediate(resolve));
  platform.emit('dismiss');
  platform.emit('shareCompleted', { targetAbilityInfo: { name: 'recipient' } });
  assert.equal(await sharing, 'shown');
  assert.deepEqual(platform.removed, []);
  assert.equal(platform.listeners.size, 0);
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

const saveSource = readFileSync(new URL('../entry/src/main/ets/platform/share/ReaderDocumentSaveHost.ts', import.meta.url), 'utf8');
const imageBytes = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 1, 2, 3, 4, 5);
const originalBytes = Uint8Array.of(0x41, 0x42, 0x43, 0x44, 0x45);

function setupSave({ destination = [], cancelled = false, openPicker, failWrite = false } = {}) {
  const events = [];
  let sourceCursor = 0;
  let writes = 0;
  class DocumentViewPicker {
    async save(options) {
      events.push(['picker', options]);
      await openPicker?.();
      return cancelled ? [] : ['file://external/new-document'];
    }
  }
  const { ReaderDocumentSaveHost } = pureModuleProbe(saveSource, 'ReaderDocumentSaveHost.ts', {
    ReaderDocumentPickerActivity: {
      windowEpoch: () => 77,
      begin(epoch) {
        events.push(['begin', epoch]);
        return { finish: () => events.push(['finish']) };
      },
    },
    picker: { DocumentViewPicker, DocumentSaveOptions: class {} },
    fileIo: {
      OpenMode: { READ_ONLY: 0, READ_WRITE: 2, NOFOLLOW: 0o400000 },
      async open(path, mode) {
        events.push(['open', path, mode]);
        return { fd: path.startsWith('file://') ? 2 : 1 };
      },
      async stat(fd) { return { isFile: () => true, size: fd === 1 ? originalBytes.length : destination.length }; },
      async read(fd, buffer) {
        assert.equal(fd, 1, 'only the retained source is read');
        const chunk = originalBytes.slice(sourceCursor, sourceCursor + buffer.byteLength);
        new Uint8Array(buffer).set(chunk);
        sourceCursor += chunk.length;
        return chunk.length;
      },
      async write(fd, buffer) {
        assert.equal(fd, 2, 'only the picker document is written');
        if (++writes > 1 && failWrite) throw new Error('destination unavailable');
        const chunk = new Uint8Array(buffer).slice(0, 3);
        destination.push(...chunk);
        return chunk.length;
      },
      async truncate(fd, size) {
        assert.equal(fd, 2);
        destination.length = size;
        events.push(['truncate', fd, size]);
      },
      async fsync(fd) { events.push(['fsync', fd]); },
      async close(file) { events.push(['close', file.fd]); },
    },
  }, ['ReaderDocumentSaveHost']);
  return { host: new ReaderDocumentSaveHost({}), destination, events };
}

test('Save As keeps the original and emits the exact encoded image despite short writes', async () => {
  const book = setupSave();
  assert.equal(await book.host.saveOriginal('/sandbox/retained.source', '../卷:二', '.epub', current), 'saved');
  assert.deepEqual(book.destination, [...originalBytes]);
  assert.deepEqual(book.events.filter(event => event[0] !== 'picker'), [
    ['open', '/sandbox/retained.source', 0o400000], ['begin', 77], ['finish'],
    ['open', 'file://external/new-document', 0o400002], ['fsync', 2], ['close', 2], ['close', 1],
  ]);
  const options = book.events.find(event => event[0] === 'picker')[1];
  assert.deepEqual(options.newFileNames, ['.._卷_二.epub']);
  assert.deepEqual(options.fileSuffixChoices, ['.epub']);
  assert.equal(Object.hasOwn(options, 'autoCreateEmptyFile'), false, 'use the picker default on phones');
  const manga = setupSave();
  assert.equal(await manga.host.saveImage(imageBytes, '漫画 第2页', current), 'saved');
  assert.deepEqual(manga.destination, [...imageBytes]);
  assert.deepEqual(manga.events.find(event => event[0] === 'picker')[1].newFileNames, ['漫画 第2页.png']);
});

test('Save As cancellation and retired picker results leave source and destination untouched', async () => {
  let active = true;
  const retired = setupSave({ openPicker() { active = false; } });
  const cancelled = setupSave({ cancelled: true });
  for (const [fixture, scope] of [[retired, () => active], [cancelled, current]]) {
    assert.equal(await fixture.host.saveOriginal('/sandbox/retained.source', '书', '.txt', scope), 'cancelled');
    assert.deepEqual(fixture.events.filter(event => event[0] !== 'picker'), [
      ['open', '/sandbox/retained.source', 0o400000], ['begin', 77], ['finish'], ['close', 1],
    ]);
    assert.deepEqual(fixture.destination, []);
  }
});

test('Save As refuses a nonempty destination and rolls a failed partial write back to empty', async () => {
  const occupied = setupSave({ destination: [9, 8, 7] });
  assert.equal(await occupied.host.saveImage(imageBytes, '漫画', current), 'destinationNotEmpty');
  assert.deepEqual(occupied.destination, [9, 8, 7]);
  assert.ok(!occupied.events.some(event => event[0] === 'truncate'));
  const broken = setupSave({ failWrite: true });
  assert.equal(await broken.host.saveOriginal('/sandbox/retained.source', '书', '.txt', current), 'failed');
  assert.deepEqual(broken.destination, []);
  assert.deepEqual(broken.events.filter(event => event[0] === 'truncate'), [['truncate', 2, 0]]);
});

test('the SDK-emitted detail buttons invoke their own actions and retire with the presented book', async () => {
  const { localBookDetailSdk } = await import('./lib/local-book-detail-sdk-probe.mjs');
  const { shown, copied, actions } = setup({ show: () => 'unavailable' });
  const { Component } = localBookDetailSdk({
    readerSystemShareActions: () => actions,
    readerShareMessage: result => ['fileCopied', 'copied'].includes(result) ? result : undefined,
    AccessibilityRoleType: { BUTTON: 'button' },
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
  for (const [id, label] of [['book', '分享书籍信息'], ['copy', '复制书籍信息'], ['file', '分享原文件'], ['save', '保存原书']]) {
    const button = [...owner.nodes.values()].find(node => node.id === `reader-detail-share-${id}`);
    assert.equal(button.accessibilityText, label);
    assert.equal(button.accessibilityRole, 'button');
    assert.equal(button.enabled, true, 'a current action is reachable by keyboard and screen reader');
  }
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
