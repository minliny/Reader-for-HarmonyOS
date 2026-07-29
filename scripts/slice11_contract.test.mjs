import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function source(relativePath) {
  return readFile(resolve(root, relativePath), 'utf8');
}

test('Slice 11 Reader bottom bar keeps canonical order and commits modules fail-closed', async () => {
  const overlay = await source('entry/src/main/ets/ui/components/ReaderOverlayComponents.ets');
  const reducer = await source('entry/src/main/ets/ui/store/ReaderReducer.ets');
  const bottom = overlay.slice(overlay.indexOf('export struct ReaderBottomBar'), overlay.indexOf('// ── Panel shell'));
  const ordered = [
    "['directory', '目录']",
    "['tts', '朗读']",
    "['appearance', '界面']",
    "['settings', '设置']",
  ];
  let cursor = -1;
  for (const marker of ordered) {
    const index = bottom.indexOf(marker);
    assert.ok(index > cursor, `missing or reordered bottom-bar item: ${marker}`);
    cursor = index;
  }
  assert.ok(bottom.includes("MotionAdapter.apply('reader.module.switch'"),
    'the admitted module nav keeps its dedicated motion contract');
  assert.ok(bottom.includes("type: 'reader.directory.open'"));
  assert.ok(bottom.includes("type: 'reader-module-switch', module: kind"));
  assert.ok(reducer.includes("state.routeId !== 'immersive-reading'"));
  assert.ok(reducer.includes('isReaderControlOverlay(state.overlay)'));
  assert.ok(reducer.includes('const targetOverlay = moduleOverlay(module)'));
  assert.ok(reducer.includes('state.overlay === targetOverlay'));
  for (const retired of [
    'reader-directory-overlay-v2',
    'reader-tts-overlay-v2',
    'reader-appearance-overlay-v2',
    'reader-settings-overlay-v2',
  ]) {
    assert.equal(bottom.includes(retired), false, `bottom bar must not recreate retired route ${retired}`);
    assert.equal(reducer.includes(retired), false, `reducer must not recreate retired route ${retired}`);
  }
});

test('Slice 11 language, online TTS region/model, dictionary and large-model controls fail closed visibly', async () => {
  const policy = await source('entry/src/main/ets/ui/store/Slice11CapabilityPolicy.ets');
  const settings = await source('entry/src/main/ets/ui/components/SettingsComponents.ets');
  const overlay = await source('entry/src/main/ets/ui/components/ReaderOverlayComponents.ets');
  for (const id of ['settings.app-language', 'tts.locale-region-model', 'rules.dictionary', 'ai.large-model']) {
    assert.match(policy, new RegExp(`id: '${id.replaceAll('.', '\\.')}'[\\s\\S]*ContractMissingFailClosed`));
  }
  assert.ok(settings.includes("title: '语言'"),
    'the current Figma Settings row remains visible as a static select');
  assert.ok(settings.includes("FigmaSettingsSelect({ value: '简体中文'"));
  assert.equal(settings.includes("settingsKey: 'appLanguage'"), false);
  assert.equal(settings.includes("settingsKey: 'dictionary'"), false);
  assert.equal(settings.includes("settingsKey: 'largeModel'"), false);
  assert.equal(settings.includes("title: '词典规则'"), false,
    'a missing dictionary contract must not invent a settings row');
  assert.equal(settings.includes("title: '大模型服务'"), false,
    'a missing AI contract must not invent a settings row');
  for (const marker of ['在线语音区域', '在线语音语言', '在线语音模型']) {
    assert.equal(overlay.includes(marker), false,
      `missing TTS contract must remain absent instead of drawing ${marker}`);
  }
});

test('Slice 11 local-book semantics derive only from Core sourceId=local without inventing a badge', async () => {
  const state = await source('entry/src/main/ets/ui/store/ReaderUiState.ets');
  const reducer = await source('entry/src/main/ets/ui/store/ReaderReducer.ets');
  const effects = await source('entry/src/main/ets/ui/store/ReaderEffects.ets');
  const bookshelf = await source('entry/src/main/ets/ui/components/BookshelfComponents.ets');
  assert.ok(state.includes('export function isLocalBookSourceId'));
  assert.ok(state.includes("return (sourceId ?? '').trim() === 'local'"));
  assert.ok(reducer.includes('isLocalBookSourceId(state.currentBook?.sourceId)'));
  assert.ok(effects.includes('isLocalBookSourceId(sourceId)'));
  assert.equal(bookshelf.includes("Text('本地')"), false,
    'the current Figma bookshelf does not define a local-book badge');
  for (const forbidden of ['bookId.includes(', 'title.includes(', 'coverUrl.includes(']) {
    assert.equal(
      (state + reducer + effects + bookshelf).includes(`${forbidden}'local'`),
      false,
      `local-book behavior must not infer from ${forbidden}`,
    );
  }
});

test('Slice 11 WebDAV shares the Figma canonical form with Sync Backup and fences insecure or stale operations', async () => {
  const structural = await source('entry/src/main/ets/ui/components/StructuralPageComponents.ets');
  const reducer = await source('entry/src/main/ets/ui/store/ReaderReducer.ets');
  const effects = await source('entry/src/main/ets/ui/store/ReaderEffects.ets');
  const credentials = await source('entry/src/main/ets/host/adapters/CredentialHostAdapter.ets');
  const webdavHost = await source('entry/src/main/ets/host/adapters/WebDavHostAdapter.ets');
  const remote = structural.slice(structural.indexOf('export struct RemoteWebDavBooksPage'), structural.indexOf('export struct RssDetailPage'));
  assert.ok(structural.includes("if (this.routeId === 'webdav-config')"));
  assert.ok(structural.includes('WebDavConfigSection()'));
  assert.ok(structural.includes("this.field === 'password' ? InputType.Password : InputType.Normal"));
  assert.ok(structural.includes("ReaderUiStore.dispatch({ type: 'webdav-test' })"));
  assert.ok(structural.includes("ReaderUiStore.dispatch({ type: 'webdav-save' })"));
  assert.ok(remote.includes('不提供按书列举或下载协议'));
  assert.equal(remote.includes('ForEach('), false);
  assert.ok(reducer.includes('static requestWebdavTest'));
  assert.ok(reducer.includes('isWebdavConfigurationRoute'));
  assert.ok(reducer.includes("routeId === 'webdav-config' || routeId === 'sync-backup'"));
  assert.ok(effects.includes("event.id === 'webdav-config'"));
  assert.ok(effects.includes("event.id === 'sync-backup'"));
  assert.ok(effects.includes('current.webdavTestStatus !== \'testing\''));
  assert.ok(effects.includes('credential.supportsProtectedSecrets()'));
  assert.ok(effects.includes('带账号或密码的 WebDAV 配置禁止持久化'));
  assert.ok(effects.includes('持久化 WebDAV 端点必须使用 HTTPS'));
  assert.ok(effects.includes("authority.indexOf('@') < 0"));
  assert.ok(credentials.includes('supportsProtectedSecrets(): boolean'));
  assert.ok(credentials.includes('return false;'));
  assert.ok(webdavHost.includes('webdav.backup requires HTTPS'));
  assert.ok(webdavHost.includes('webdav.restore requires HTTPS'));
  assert.ok(webdavHost.includes('must not contain URL user info'));
});

test('Slice 11 policy does not overclaim service or security proof', async () => {
  const policy = await source('entry/src/main/ets/ui/store/Slice11CapabilityPolicy.ets');
  assert.match(policy, /id: 'reader\.bottom-bar'[\s\S]*Production/);
  assert.match(policy, /id: 'bookshelf\.local-book-style'[\s\S]*Production/);
  assert.match(policy, /id: 'bookshelf\.local-book-style-persistence'[\s\S]*ContractMissingFailClosed/);
  assert.match(policy, /id: 'sync\.webdav-transport'[\s\S]*ServiceProofRequired/);
  assert.match(policy, /id: 'sync\.webdav-authenticated-persistence'[\s\S]*HostSecurityBlockedFailClosed/);
  assert.match(policy, /id: 'sync\.webdav-remote-books'[\s\S]*ContractMissingFailClosed/);
});
