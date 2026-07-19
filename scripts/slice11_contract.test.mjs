import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function source(relativePath) {
  return readFile(resolve(root, relativePath), 'utf8');
}

test('Slice 11 Reader bottom bar keeps canonical order, active routes and module motion', async () => {
  const overlay = await source('entry/src/main/ets/ui/components/ReaderOverlayComponents.ets');
  const reducer = await source('entry/src/main/ets/ui/store/ReaderReducer.ets');
  const bottom = overlay.slice(overlay.indexOf('export struct ReaderBottomBar'), overlay.indexOf('// ── Panel shell'));
  const ordered = [
    "['directory', '目录', 'reader-directory-overlay-v2']",
    "['tts', '朗读', 'reader-tts-overlay-v2']",
    "['appearance', '界面', 'reader-appearance-overlay-v2']",
    "['settings', '设置', 'reader-settings-overlay-v2']",
  ];
  let cursor = -1;
  for (const marker of ordered) {
    const index = bottom.indexOf(marker);
    assert.ok(index > cursor, `missing or reordered bottom-bar item: ${marker}`);
    cursor = index;
  }
  assert.ok(bottom.includes("MotionAdapter.apply('reader.module.switch'"));
  assert.ok(bottom.includes("type: 'reader.directory.open'"));
  assert.ok(bottom.includes("type: 'reader-module-switch', module: kind"));
  assert.ok(reducer.includes('isReaderModuleOverlay(state.stack[state.stack.length - 1].id)'));
  assert.ok(reducer.includes('return ReaderReducer.replace(state, targetId)'));
});

test('Slice 11 language, online TTS region/model, dictionary and large-model controls fail closed visibly', async () => {
  const policy = await source('entry/src/main/ets/ui/store/Slice11CapabilityPolicy.ets');
  const settings = await source('entry/src/main/ets/ui/components/SettingsComponents.ets');
  const overlay = await source('entry/src/main/ets/ui/components/ReaderOverlayComponents.ets');
  for (const id of ['settings.app-language', 'tts.locale-region-model', 'rules.dictionary', 'ai.large-model']) {
    assert.match(policy, new RegExp(`id: '${id.replaceAll('.', '\\.')}'[\\s\\S]*ContractMissingFailClosed`));
  }
  for (const marker of [
    "title: '语言'",
    "title: '词典规则'",
    "title: '大模型服务'",
    "value: '合同缺失'",
  ]) assert.ok(settings.includes(marker), `missing fail-closed settings marker: ${marker}`);
  for (const marker of ["title: '在线语音区域'", "title: '在线语音语言'", "title: '在线语音模型'"]) {
    assert.ok(overlay.includes(marker), `missing fail-closed TTS marker: ${marker}`);
  }
  assert.ok(overlay.includes("ReaderFullBlock({ title: '在线语音', meta: 'HttpTTS 合同与凭据/播放闭环未接入' })"));
  assert.equal(settings.includes("settingsKey: 'appLanguage'"), false);
  assert.equal(settings.includes("settingsKey: 'dictionary'"), false);
  assert.equal(settings.includes("settingsKey: 'largeModel'"), false);
});

test('Slice 11 local-book style is reducer-backed and derives only from Core sourceId=local', async () => {
  const state = await source('entry/src/main/ets/ui/store/ReaderUiState.ets');
  const fixture = await source('entry/src/main/ets/ui/fixtures/DemoUiState.ets');
  const reducer = await source('entry/src/main/ets/ui/store/ReaderReducer.ets');
  const store = await source('entry/src/main/ets/ui/store/ReaderUiStore.ets');
  const settings = await source('entry/src/main/ets/ui/components/SettingsComponents.ets');
  const bookshelf = await source('entry/src/main/ets/ui/components/BookshelfComponents.ets');
  assert.ok(state.includes("| 'showLocalBookBadge';"));
  assert.ok(fixture.includes('showLocalBookBadge: true'));
  assert.ok(reducer.includes("case 'showLocalBookBadge':"));
  assert.ok(store.includes("reader.settingsToggles.showLocalBookBadge"));
  assert.ok(settings.includes("title: '本地书标识'"));
  assert.ok(settings.includes("settingsKey: 'showLocalBookBadge'"));
  assert.ok(bookshelf.includes("this.sourceId === 'local'"));
  assert.ok(bookshelf.includes("this.coreContinueBook()?.sourceId === 'local'"));
  assert.ok(bookshelf.includes("Text('本地')"));
  for (const forbidden of ['bookId.includes(', 'title.includes(', 'coverUrl.includes(']) {
    assert.equal(bookshelf.includes(`${forbidden}'local'`), false, `local style must not infer from ${forbidden}`);
  }
});

test('Slice 11 WebDAV separates config from backup and fences insecure or stale operations', async () => {
  const structural = await source('entry/src/main/ets/ui/components/StructuralPageComponents.ets');
  const reducer = await source('entry/src/main/ets/ui/store/ReaderReducer.ets');
  const effects = await source('entry/src/main/ets/ui/store/ReaderEffects.ets');
  const credentials = await source('entry/src/main/ets/host/adapters/CredentialHostAdapter.ets');
  const webdavHost = await source('entry/src/main/ets/host/adapters/WebDavHostAdapter.ets');
  const remote = structural.slice(structural.indexOf('export struct RemoteWebDavBooksPage'), structural.indexOf('export struct RssDetailPage'));
  assert.ok(structural.includes("if (this.routeId === 'webdav-config')"));
  assert.ok(structural.includes("Text('打开 WebDAV 配置')"));
  assert.ok(structural.includes(".type(this.field === 'password' ? InputType.Password : InputType.Normal)"));
  assert.ok(structural.includes('当前 Host 尚未接入 HUKS'));
  assert.ok(remote.includes('不提供按书列举或下载协议'));
  assert.equal(remote.includes('ForEach('), false);
  assert.ok(reducer.includes('static requestWebdavTest'));
  assert.ok(reducer.includes("state.routeId !== 'webdav-config' || state.webdavTestStatus !== 'testing'"));
  assert.ok(reducer.includes("state.routeId !== 'webdav-config' || state.webdavSaveStatus !== 'saving'"));
  assert.ok(effects.includes("event.id === 'webdav-config'"));
  assert.ok(effects.includes('current.webdavTestStatus !== \'testing\''));
  assert.ok(effects.includes('credential.supportsProtectedSecrets()'));
  assert.ok(effects.includes('带账号或密码的 WebDAV 配置禁止持久化'));
  assert.ok(effects.includes('持久化 WebDAV 端点必须使用 HTTPS'));
  assert.ok(effects.includes("authority.indexOf('@') < 0"));
  assert.ok(structural.includes('完整地址不会在备份页回显'));
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
