import { describe, it, expect } from '@ohos/hypium';
import {
  HostRequestTable,
  type HostRequestType,
} from '../main/ets/contract/generated/HostRequestTable';
import { ReaderUiHostDispatcher } from '../main/ets/host/ReaderUiHostDispatcher';
import { ReaderUiHostCapabilityManifest } from '../main/ets/host/ReaderUiHostCapabilityManifest';
import {
  ReaderUiHostFailure,
  type ReaderUiHostPayload,
  type ReaderUiHostPlatform,
  type ReaderUiHostRequest,
} from '../main/ets/host/ReaderUiHostContract';
import { CoreHostAdapter } from '../main/ets/host/adapters/CoreHostAdapter';
import { FontHostAdapter } from '../main/ets/host/adapters/FontHostAdapter';
import { HostErrorWrapper } from '../main/ets/host/types';

const NEW_25_TYPES: string[] = [
  'file.select', 'font.registerFile', 'clipboard.read', 'clipboard.write',
  'tts.start', 'tts.stop', 'tts.pause', 'brightness.set', 'brightness.get',
  'screen.keepAwake', 'screen.allowSleep', 'haptics.light', 'haptics.medium',
  'haptics.heavy', 'network.status', 'webdav.connect', 'webdav.backup',
  'webdav.restore', 'share.text', 'share.file', 'background.task.start',
  'background.task.end',
];
const W4_HOST_TYPES: string[] = ['persistence.get', 'persistence.put', 'font.unregisterFile'];

function emptyPayload(): ReaderUiHostPayload {
  return new Object() as Object as ReaderUiHostPayload;
}

class FakeReaderUiHostPlatform implements ReaderUiHostPlatform {
  available: boolean = true;
  executed: HostRequestType[] = [];

  isAvailable(_type: HostRequestType): boolean {
    return this.available;
  }

  execute(type: HostRequestType, _payload: ReaderUiHostPayload,
    _request: ReaderUiHostRequest): Promise<ReaderUiHostPayload> {
    this.executed.push(type);
    const result = emptyPayload();
    result['accepted'] = true;
    return Promise.resolve(result);
  }
}

class StructuredFailureReaderUiHostPlatform extends FakeReaderUiHostPlatform {
  execute(_type: HostRequestType, _payload: ReaderUiHostPayload,
    _request: ReaderUiHostRequest): Promise<ReaderUiHostPayload> {
    return Promise.reject(new HostErrorWrapper({
      code: 'FILE_NOT_FOUND',
      message: 'missing media file',
      retryable: false,
      details: { phase: 'Storage', path: 'cache://missing.pdf' },
    }));
  }
}

function validPayload(type: HostRequestType): ReaderUiHostPayload {
  const payload = emptyPayload();
  switch (type) {
    case 'http.execute':
      payload['url'] = 'https://reader.example/resource';
      payload['method'] = 'GET';
      payload['headers'] = new Object();
      return payload;
    case 'http.cancel': payload['requestId'] = 'http-1'; return payload;
    case 'webview.open': payload['url'] = 'https://reader.example'; return payload;
    case 'webview.close': return payload;
    case 'webview.evaluate': payload['script'] = 'document.title'; return payload;
    case 'cookie.get': return payload;
    case 'cookie.set': payload['name'] = 'sid'; payload['value'] = 'v'; return payload;
    case 'cookie.clear': return payload;
    case 'file.read': payload['path'] = 'files://book.txt'; return payload;
    case 'file.write': payload['path'] = 'files://book.txt'; payload['content'] = 'body'; return payload;
    case 'file.delete': payload['path'] = 'files://book.txt'; return payload;
    case 'storage.path': payload['scope'] = 'files'; return payload;
    case 'persistence.get': payload['namespace'] = 'reader-ui'; payload['key'] = 'appearance.v1'; return payload;
    case 'persistence.put':
      payload['namespace'] = 'reader-ui'; payload['key'] = 'appearance.v1';
      payload['value'] = '{"schemaVersion":1}'; payload['expectedRevision'] = '0'; return payload;
    case 'credential.get': payload['key'] = 'reader'; return payload;
    case 'credential.set': payload['key'] = 'reader'; payload['value'] = ''; return payload;
    case 'credential.delete': payload['key'] = 'reader'; return payload;
    case 'tts.system.start': payload['text'] = 'read'; return payload;
    case 'tts.system.stop':
    case 'tts.system.pause':
    case 'tts.system.resume': return payload;
    case 'permission.request':
    case 'permission.check': payload['scope'] = 'ohos.permission.READ_PASTEBOARD'; return payload;
    case 'background.schedule': payload['taskId'] = 'legacy-bg'; payload['delayMs'] = 1000; return payload;
    case 'background.cancel': payload['taskId'] = 'legacy-bg'; return payload;
    case 'timer.foreground.arm':
    case 'timer.foreground.cancel':
      payload['timerId'] = 'timer-1'; payload['correlationId'] = 'timer-1';
      payload['delayMs'] = 1000; payload['generation'] = 1;
      payload['oneShot'] = true; payload['foregroundOnly'] = true; return payload;
    case 'notification.show': payload['id'] = 'reader-test'; payload['title'] = 'Reader'; payload['body'] = ''; return payload;
    case 'notification.cancel': payload['id'] = '1'; return payload;
    case 'share.invoke': payload['text'] = 'Reader'; return payload;
    case 'clipboard.copy': payload['text'] = ''; return payload;
    case 'clipboard.paste': return payload;
    case 'device.vibrate': payload['durationMs'] = 15; return payload;
    case 'device.screen.keep-on': payload['enabled'] = true; return payload;
    case 'device.screen.release': return payload;
    case 'file.select': payload['mimeTypes'] = ['*/*']; payload['allowsMultiple'] = false; return payload;
    case 'font.registerFile': payload['path'] = '/data/reader.otf'; return payload;
    case 'font.unregisterFile':
      payload['path'] = '/data/reader.otf'; payload['familyName'] = 'reader-font-a'; return payload;
    case 'clipboard.read': return payload;
    case 'clipboard.write': payload['text'] = ''; return payload;
    case 'tts.start': payload['text'] = 'read'; payload['rate'] = 1; payload['pitch'] = 1; return payload;
    case 'tts.stop':
    case 'tts.pause':
    case 'brightness.get':
    case 'screen.keepAwake':
    case 'screen.allowSleep':
    case 'haptics.light':
    case 'haptics.medium':
    case 'haptics.heavy':
    case 'network.status': return payload;
    case 'brightness.set': payload['value'] = 0.5; return payload;
    case 'webdav.connect': payload['url'] = 'https://dav.example/reader'; return payload;
    case 'webdav.backup': return payload;
    case 'webdav.restore': payload['remoteURL'] = 'https://dav.example/reader/backup.json'; return payload;
    case 'share.text': payload['text'] = 'Reader'; return payload;
    case 'share.file': payload['path'] = 'file://reader/book.epub'; return payload;
    case 'background.task.start': payload['name'] = 'source-refresh'; return payload;
    case 'background.task.end': payload['taskId'] = 'harmony-transient-1'; return payload;
    default: throw new Error(`Missing valid payload for ${type}`);
  }
}

async function capturedCode(dispatcher: ReaderUiHostDispatcher,
  request: ReaderUiHostRequest): Promise<string> {
  try {
    await dispatcher.dispatch(request);
    return '';
  } catch (e) {
    return e instanceof ReaderUiHostFailure ? e.code : 'UNEXPECTED';
  }
}

export default function ReaderUi25HostDispatcherTests(): void {
  describe('ReaderUi25HostDispatcher', () => {
    it('generated_manifest_and_dispatcher_are_exact_58', 0, () => {
      const platform = new FakeReaderUiHostPlatform();
      const dispatcher = new ReaderUiHostDispatcher(platform);
      const manifest = new ReaderUiHostCapabilityManifest(
        (type: HostRequestType): boolean => platform.isAvailable(type),
      );
      expect(HostRequestTable.SCHEMA_VERSION).assertEqual('1.2.0');
      expect(HostRequestTable.ALL.length).assertEqual(58);
      expect(new Set<string>(HostRequestTable.ALL).size).assertEqual(58);
      expect(dispatcher.registeredTypes().length).assertEqual(58);
      expect(manifest.entries().length).assertEqual(58);
      expect(manifest.summary().total).assertEqual(58);
      expect(manifest.summary().available).assertEqual(58);
      expect(manifest.summary().deviceVerified).assertEqual(0);
      expect(manifest.summary().hostUnit).assertEqual(7);
      expect(manifest.summary().simulator).assertEqual(15);
      expect(manifest.summary().physicalDevice).assertEqual(36);
    });

    it('new_Reader_UI_25_set_is_exactly_22', 0, () => {
      const actual = HostRequestTable.ALL
        .filter((type: HostRequestType): boolean => NEW_25_TYPES.indexOf(type) >= 0)
        .map((type: HostRequestType): string => type).sort();
      const expected = NEW_25_TYPES.slice().sort();
      expect(actual.length).assertEqual(22);
      expect(actual.join('|')).assertEqual(expected.join('|'));
    });

    it('W4_Host_set_is_exactly_3', 0, () => {
      const actual = HostRequestTable.ALL
        .filter((type: HostRequestType): boolean => W4_HOST_TYPES.indexOf(type) >= 0)
        .map((type: HostRequestType): string => type).sort();
      expect(actual.length).assertEqual(3);
      expect(actual.join('|')).assertEqual(W4_HOST_TYPES.slice().sort().join('|'));
    });

    it('W4_persistence_CAS_and_logical_font_unregister_are_real_Host_behaviors', 0, async () => {
      const persistence = new CoreHostAdapter();
      const missing = await persistence.persistenceGet({ namespace: 'reader-ui', key: 'appearance.v1' });
      expect(missing.found).assertFalse();
      const stored = await persistence.persistencePut({
        namespace: 'reader-ui', key: 'appearance.v1', value: '{"schemaVersion":1}', expectedRevision: '0',
      });
      expect(stored.stored).assertTrue();
      expect(stored.revision).assertEqual('1');
      const loaded = await persistence.persistenceGet({ namespace: 'reader-ui', key: 'appearance.v1' });
      expect(loaded.found).assertTrue();
      expect(loaded.value).assertEqual('{"schemaVersion":1}');
      expect(loaded.revision).assertEqual('1');
      let conflict = false;
      try {
        await persistence.persistencePut({
          namespace: 'reader-ui', key: 'appearance.v1', value: '{}', expectedRevision: '0',
        });
      } catch (_e) {
        conflict = true;
      }
      expect(conflict).assertTrue();

      const unregistered = new FontHostAdapter().unregisterFile(
        '/data/reader.otf', 'requested-provisional-family',
      );
      expect(unregistered.logicalUnregistered).assertTrue();
      expect(unregistered.physicallyUnregistered).assertFalse();
      expect(unregistered.restartRequired).assertTrue();
    });

    it('W4_persistence_CAS_admits_exactly_one_concurrent_writer', 0, async () => {
      const persistence = new CoreHostAdapter();
      await persistence.persistencePut({
        namespace: 'reader-ui', key: 'appearance.concurrent', value: 'initial', expectedRevision: '0',
      });
      const attempts = await Promise.all([
        persistence.persistencePut({
          namespace: 'reader-ui', key: 'appearance.concurrent', value: 'first', expectedRevision: '1',
        }).then((): boolean => true).catch((): boolean => false),
        persistence.persistencePut({
          namespace: 'reader-ui', key: 'appearance.concurrent', value: 'second', expectedRevision: '1',
        }).then((): boolean => true).catch((): boolean => false),
      ]);
      expect(attempts.filter((success: boolean): boolean => success).length).assertEqual(1);
      const loaded = await persistence.persistenceGet({
        namespace: 'reader-ui', key: 'appearance.concurrent',
      });
      expect(loaded.revision).assertEqual('2');
    });

    it('all_58_valid_DTOs_reach_the_explicit_platform_once', 0, async () => {
      const platform = new FakeReaderUiHostPlatform();
      const dispatcher = new ReaderUiHostDispatcher(platform);
      for (let i = 0; i < HostRequestTable.ALL.length; i++) {
        const type = HostRequestTable.ALL[i];
        const response = await dispatcher.dispatch({
          type: type,
          payload: validPayload(type),
          requestId: `request-${i}`,
          correlationId: `correlation-${i}`,
          initiator: 'reducer',
        });
        expect(response.type).assertEqual(type);
        expect(response.requestId).assertEqual(`request-${i}`);
        expect(response.correlationId).assertEqual(`correlation-${i}`);
      }
      expect(platform.executed.length).assertEqual(58);
      expect(platform.executed.join('|')).assertEqual(HostRequestTable.ALL.join('|'));
    });

    it('unknown_unavailable_and_invalid_DTOs_fail_closed', 0, async () => {
      const platform = new FakeReaderUiHostPlatform();
      const dispatcher = new ReaderUiHostDispatcher(platform);
      expect(await capturedCode(dispatcher, {
        type: 'host.catchAll', payload: emptyPayload(),
      })).assertEqual('UNKNOWN_CAPABILITY');

      const invalidFile = emptyPayload();
      invalidFile['mimeTypes'] = [];
      expect(await capturedCode(dispatcher, {
        type: 'file.select', payload: invalidFile,
      })).assertEqual('INVALID_PARAMS');

      const partialWebDav = emptyPayload();
      partialWebDav['serverURL'] = 'https://dav.example';
      expect(await capturedCode(dispatcher, {
        type: 'webdav.backup', payload: partialWebDav,
      })).assertEqual('INVALID_PARAMS');

      const invalidTts = emptyPayload();
      invalidTts['text'] = 'read'; invalidTts['rate'] = 9;
      expect(await capturedCode(dispatcher, {
        type: 'tts.start', payload: invalidTts,
      })).assertEqual('INVALID_PARAMS');

      const notificationWithoutId = emptyPayload();
      notificationWithoutId['title'] = 'Reader';
      notificationWithoutId['body'] = 'download complete';
      expect(await capturedCode(dispatcher, {
        type: 'notification.show', payload: notificationWithoutId,
      })).assertEqual('INVALID_PARAMS');

      platform.available = false;
      expect(await capturedCode(dispatcher, {
        type: 'network.status', payload: emptyPayload(),
      })).assertEqual('CAPABILITY_UNAVAILABLE');
    });

    it('structured_host_errors_keep_their_contract_code', 0, async () => {
      const dispatcher = new ReaderUiHostDispatcher(new StructuredFailureReaderUiHostPlatform());
      expect(await capturedCode(dispatcher, {
        type: 'file.read', payload: validPayload('file.read'),
      })).assertEqual('FILE_NOT_FOUND');
    });
  });
}
