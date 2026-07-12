import { describe, it, expect } from '@ohos/hypium';
import type { JsonObject } from '../main/ets/bridge/core/sdk/reader_core';
import type {
  HostCredentialGetRequest,
  HostCredentialGetResponse,
  HostHttpRequest,
  HostHttpResponse,
} from '../main/ets/host/types';
import {
  WebDavHostAdapter,
  type WebDavCredentialReader,
  type WebDavHttpExecutor,
} from '../main/ets/host/adapters/WebDavHostAdapter';

const CHECKSUM: string = '0000000000000000000000000000000000000000000000000000000000000000';
const PAYLOAD: string = '{"x":1}';

class FakeHttpResponse implements HostHttpResponse {
  status: number;
  body: string;

  constructor(status: number, body: string = '') {
    this.status = status;
    this.body = body;
  }
}

class FakeWebDavHttp implements WebDavHttpExecutor {
  responses: FakeHttpResponse[] = [];
  requests: HostHttpRequest[] = [];

  execute(request: HostHttpRequest, _requestId?: string): Promise<HostHttpResponse> {
    this.requests.push(request);
    const response = this.responses.shift();
    if (response === undefined) return Promise.reject(new Error('missing fake response'));
    return Promise.resolve(response);
  }
}

class FakeWebDavCredentials implements WebDavCredentialReader {
  get(request: HostCredentialGetRequest): Promise<HostCredentialGetResponse> {
    let value = '';
    if (request.key === 'webdav.url') value = 'https://dav.example/root';
    if (request.key === 'webdav.user') value = 'reader';
    if (request.key === 'webdav.password') value = 'secret';
    const response: HostCredentialGetResponse = { exists: true, value: value };
    return Promise.resolve(response);
  }
}

function exportedSnapshot(): JsonObject {
  const manifest: JsonObject = {};
  manifest['schemaVersion'] = 1;
  manifest['bytes'] = 7;
  manifest['checksum'] = CHECKSUM;
  manifest['exportedAt'] = 1;
  const result: JsonObject = {};
  result['manifest'] = manifest;
  result['payload'] = PAYLOAD;
  return result;
}

function emptyJson(): JsonObject {
  return new Object() as Object as JsonObject;
}

function serializedSnapshot(): string {
  const root: JsonObject = {};
  root['format'] = 'reader-core-storage-backup';
  root['formatVersion'] = 1;
  const exported = exportedSnapshot() as Object as Record<string, Object>;
  root['manifest'] = exported['manifest'];
  root['payload'] = exported['payload'];
  return JSON.stringify(root);
}

export default function ReaderUi25WebDavHostAdapterTests(): void {
  describe('ReaderUi25WebDavHostAdapter', () => {
    it('connect_requires_real_HTTP_207', 0, async () => {
      const http = new FakeWebDavHttp();
      http.responses.push(new FakeHttpResponse(207));
      const adapter = new WebDavHostAdapter(
        http,
        new FakeWebDavCredentials(),
        (): Promise<JsonObject> => Promise.resolve(exportedSnapshot()),
        (_manifest: JsonObject, _payload: string): Promise<JsonObject> => Promise.resolve(emptyJson()),
      );
      const response = await adapter.connect();
      expect(response.connected).assertTrue();
      expect(response.statusCode).assertEqual(207);
      expect(http.requests.length).assertEqual(1);
      expect(http.requests[0].method).assertEqual('PROPFIND');
      expect(http.requests[0].headers['Authorization'].startsWith('Basic ')).assertTrue();
    });

    it('backup_exports_Core_and_restore_applies_validated_envelope', 0, async () => {
      const http = new FakeWebDavHttp();
      http.responses.push(new FakeHttpResponse(201));
      http.responses.push(new FakeHttpResponse(200, serializedSnapshot()));
      let applied = false;
      let appliedPayload = '';
      const adapter = new WebDavHostAdapter(
        http,
        new FakeWebDavCredentials(),
        (): Promise<JsonObject> => Promise.resolve(exportedSnapshot()),
        (_manifest: JsonObject, payload: string): Promise<JsonObject> => {
          applied = true;
          appliedPayload = payload;
          const result: JsonObject = {};
          result['applied'] = true;
          return Promise.resolve(result);
        },
      );
      const backup = await adapter.backup();
      expect(backup.backedUp).assertTrue();
      expect(http.requests[0].method).assertEqual('PUT');
      expect((http.requests[0].body ?? '').indexOf('reader-core-storage-backup') >= 0).assertTrue();

      const restore = await adapter.restore('https://dav.example/root/backup.json');
      expect(restore.restored).assertTrue();
      expect(restore.applied).assertTrue();
      expect(applied).assertTrue();
      expect(appliedPayload).assertEqual(PAYLOAD);
      expect(http.requests[1].method).assertEqual('GET');
    });

    it('connect_and_restore_fail_closed_on_bad_server_or_envelope', 0, async () => {
      const http = new FakeWebDavHttp();
      http.responses.push(new FakeHttpResponse(200));
      http.responses.push(new FakeHttpResponse(200, '{}'));
      const adapter = new WebDavHostAdapter(
        http,
        new FakeWebDavCredentials(),
        (): Promise<JsonObject> => Promise.resolve(exportedSnapshot()),
        (_manifest: JsonObject, _payload: string): Promise<JsonObject> => Promise.resolve(emptyJson()),
      );
      let connectFailed = false;
      try {
        await adapter.connect();
      } catch (e) {
        connectFailed = true;
      }
      expect(connectFailed).assertTrue();

      let restoreFailed = false;
      try {
        await adapter.restore('https://dav.example/root/backup.json');
      } catch (e) {
        restoreFailed = true;
      }
      expect(restoreFailed).assertTrue();
    });
  });
}
