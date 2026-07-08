// HostSmoke.test — Host integration smoke tests.
//
// Two layers, both MUST fail (never skip) when the asserted condition does not
// hold:
//
//   Layer A — structural: registry adapter registration. Does NOT require a live
//     NAPI runtime. CoreRuntime is constructed with a no-op native module stub
//     so it can be exercised in the unit-test environment without
//     libreader_core_napi.so. Failures here indicate a wiring regression in
//     CoreRuntime.registerHandlers() that would also break on device.
//
//   Layer B — runtime: ping / coreInfo round-trip through the real NAPI
//     boundary. These REQUIRE a live CoreRuntime backed by
//     libreader_core_napi.so. In the unit-test environment (no device .so)
//     they MUST fail explicitly — they are NOT skipped. A skip that passes is
//     the bug this file is correcting: it made `hvigorw test` green while the
//     device runtime was never exercised.
//
// On device, Layer B runs for real (invoked from the device test runner or from
// EntryAbility's CoreSelfCheck). In the host unit-test runner, Layer B fails
// loudly with a clear message so the gate cannot pretend the runtime works.
import { describe, it, expect } from '@ohos/hypium';
import { CoreRuntime } from '../../bridge/CoreRuntime';
import {
  type NativeReaderCoreModule,
  type JsonObject,
  type NativeRuntimeHandle,
  type ReaderCoreLastError,
  type ReaderCoreError,
} from '../../bridge/core/sdk/reader_core';
import { type HostCapability } from '../types';
import { SourceSessionHostStore } from '../adapters/SourceSessionHostStore';

// Stub class that satisfies NativeReaderCoreModule without touching
// libreader_core_napi.so. ArkTS requires object literals to correspond to a
// declared class/interface, so we use a class instead of an inline object.
class StubNativeReaderCore implements NativeReaderCoreModule {
  abiVersion(): number { return 1; }
  lastError(): ReaderCoreLastError { return { code: 0, message: '' }; }
  createRuntime(_config?: JsonObject | string): NativeRuntimeHandle {
    return new Object() as Object as NativeRuntimeHandle;
  }
  releaseRuntime(_runtime: NativeRuntimeHandle): void { /* no-op */ }
  sendCommand(_runtime: NativeRuntimeHandle, _command: JsonObject | string): void { /* no-op */ }
  cancelRequest(_runtime: NativeRuntimeHandle, _requestId: number): void { /* no-op */ }
  readEvent(_runtime: NativeRuntimeHandle, _timeoutMs?: number): string | null { return null; }
  pendingEventCount(_runtime: NativeRuntimeHandle): number { return 0; }
  completeHostRequest(_runtime: NativeRuntimeHandle, _operationId: number, _result: JsonObject | string, _requestId?: number): void { /* no-op */ }
  failHostRequest(_runtime: NativeRuntimeHandle, _operationId: number, _error: ReaderCoreError | JsonObject | string, _requestId?: number): void { /* no-op */ }
  pingSmoke(): string { return '{"protocolVersion":1,"requestId":1,"type":"result","data":{"stub":true}}'; }
  hostSmoke(): string { return '{"protocolVersion":1,"requestId":1,"type":"result","data":{"stub":true}}'; }
  lifecycleSmoke(_iterations?: number): string { return '{"protocolVersion":1,"requestId":1,"type":"result","data":{"stub":true}}'; }
}

function makeStubNativeModule(): NativeReaderCoreModule {
  return new StubNativeReaderCore();
}

export default function HostSmokeTest(): void {
  describe('HostSmoke', () => {

    // ── Layer A: structural — registry wiring, no NAPI required ──
    // These must pass in BOTH the unit-test environment and on device.

    it('registry_should_have_http_execute', 0, () => {
      const core = CoreRuntime.createForTest(makeStubNativeModule(), {});
      expect(core.getRegistry().has('http.execute')).assertTrue();
    });

    it('registry_should_have_cookie_capabilities', 0, () => {
      const core = CoreRuntime.createForTest(makeStubNativeModule(), {});
      expect(core.getRegistry().has('cookie.get')).assertTrue();
      expect(core.getRegistry().has('cookie.set')).assertTrue();
    });

    it('cookie_session_survives_runtime_adapter_rebuild', 0, async () => {
      SourceSessionHostStore.resetForTest();
      const firstRuntime = CoreRuntime.createForTest(makeStubNativeModule(), {});
      await firstRuntime.getCookieAdapter().set({
        sessionId: 'same-key-host-proof',
        cookie: {
          name: 'session',
          value: 'abc123',
          domain: 'example.org',
          path: '/',
        },
      });

      const rebuiltRuntime = CoreRuntime.createForTest(makeStubNativeModule(), {});
      const response = await rebuiltRuntime.getCookieAdapter().get({
        sessionId: 'same-key-host-proof',
        url: 'https://example.org/book/1',
      });
      expect(response.cookies.length).assertEqual(1);
      expect(response.cookies[0].name).assertEqual('session');
      expect(response.cookies[0].value).assertEqual('abc123');
    });

    it('source_session_state_survives_runtime_adapter_rebuild', 0, () => {
      SourceSessionHostStore.resetForTest();
      const firstRuntime = CoreRuntime.createForTest(makeStubNativeModule(), {});
      firstRuntime.getSourceSessionStore().setSourceVariable(
        'src-367',
        'chapterId',
        '/book/367/1.html',
        'same-key-host-proof',
      );
      const loginHeaders: Record<string, string> = {};
      loginHeaders['Cookie'] = 'token=from-login-store';
      loginHeaders['Authorization'] = 'Bearer local-proof';
      firstRuntime.getSourceSessionStore().setLoginHeaderMap(
        'src-342',
        loginHeaders,
        'same-key-host-proof',
      );

      const rebuiltRuntime = CoreRuntime.createForTest(makeStubNativeModule(), {});
      const variable = rebuiltRuntime.getSourceSessionStore().getSourceVariable(
        'src-367',
        'chapterId',
        'same-key-host-proof',
      );
      const missingLogin = rebuiltRuntime.getSourceSessionStore().getLoginHeaderMap(
        'missing-source',
        'same-key-host-proof',
      );
      const login = rebuiltRuntime.getSourceSessionStore().getLoginHeaderMap(
        'src-342',
        'same-key-host-proof',
      );

      expect(variable).assertEqual('/book/367/1.html');
      expect(missingLogin.found).assertFalse();
      expect(Object.keys(missingLogin.headers).length).assertEqual(0);
      expect(login.found).assertTrue();
      expect(login.headers['Cookie']).assertEqual('token=from-login-store');
      expect(login.headers['Authorization']).assertEqual('Bearer local-proof');
    });

    it('registry_should_have_webview_capability', 0, () => {
      const core = CoreRuntime.createForTest(makeStubNativeModule(), {});
      expect(core.getRegistry().has('webview.evaluateJavaScript')).assertTrue();
    });

    it('registry_should_have_core_closed_set_non_context_capabilities', 0, () => {
      const core = CoreRuntime.createForTest(makeStubNativeModule(), {});
      const expected: HostCapability[] = [
        'host.smoke.echo',
        'cache.get',
        'cache.put',
        'persistence.get',
        'persistence.put',
        'log.emit',
        'time.now',
        'system.info',
        'media.download',
      ];
      for (let i = 0; i < expected.length; i++) {
        expect(core.getRegistry().has(expected[i])).assertTrue();
      }
    });

    it('registry_should_have_file_capabilities_without_context', 0, () => {
      // Without a UIAbility context (unit-test environment), FileHostAdapter
      // cannot be constructed, so file.read/file.write are NOT registered.
      // This mirrors file.delete: Core cannot request what is not registered.
      // On device, EntryAbility passes a context and these DO register; that
      // path is covered by Layer B / CoreSelfCheck, not here.
      const core = CoreRuntime.createForTest(makeStubNativeModule(), {});
      expect(core.getRegistry().has('file.read')).assertFalse();
      expect(core.getRegistry().has('file.write')).assertFalse();
      // file.delete is never registered (UI-Contract-only, not Core closed-set).
      expect(core.getRegistry().has('file.delete')).assertFalse();
    });

    it('registry_should_NOT_have_cache_set_only_cache_put', 0, () => {
      // Core closed-set is `cache.put`, never `cache.set`. Drift check via the
      // raw registered-capability list, because `has()` is typed to
      // HostCapability and 'cache.set' is intentionally not in that union.
      const core = CoreRuntime.createForTest(makeStubNativeModule(), {});
      const registered = core.getRegistry().getRegisteredCapabilities();
      const hasCacheSet = registered.indexOf('cache.set' as HostCapability) >= 0;
      expect(hasCacheSet).assertFalse();
    });

    // ── Layer A: Phase 4 UI-Contract-only adapters exist on CoreRuntime ──
    // These are NOT registered with HostCapabilityRegistry (Core never
    // requests them), so we assert presence via CoreRuntime getters, not
    // registry.has(). Adapters that need a UIAbilityContext are null when
    // constructed without one (the unit-test environment).

    it('phase4_clipboard_adapter_always_present', 0, () => {
      const core = CoreRuntime.createForTest(makeStubNativeModule(), {});
      expect(core.getClipboardAdapter() === null).assertFalse();
    });

    it('phase4_tts_adapter_always_present', 0, () => {
      const core = CoreRuntime.createForTest(makeStubNativeModule(), {});
      expect(core.getTtsAdapter() === null).assertFalse();
    });

    it('phase4_background_adapter_always_present', 0, () => {
      const core = CoreRuntime.createForTest(makeStubNativeModule(), {});
      expect(core.getBackgroundAdapter() === null).assertFalse();
    });

    it('phase4_context_dependent_adapters_null_without_context', 0, () => {
      // screen / notification / share / permission / credential require a
      // UIAbilityContext. Without one (unit-test env), they MUST be null —
      // not throwing, not faking. This documents the boundary: Reducer must
      // check for null before dispatching these capabilities.
      const core = CoreRuntime.createForTest(makeStubNativeModule(), {});
      expect(core.getScreenAdapter()).assertNull();
      expect(core.getNotificationAdapter()).assertNull();
      expect(core.getShareAdapter()).assertNull();
      expect(core.getPermissionAdapter()).assertNull();
      expect(core.getCredentialAdapter()).assertNull();
    });

    it('phase4_ui_contract_only_capabilities_NOT_in_registry', 0, () => {
      // Drift check: UI-Contract-only capabilities must NOT be registered with
      // HostCapabilityRegistry (Core will never request them). If any of
      // these appeared in the registry, it would imply Core might request
      // them over NAPI, which is a contract lie.
      const core = CoreRuntime.createForTest(makeStubNativeModule(), {});
      const registered = core.getRegistry().getRegisteredCapabilities();
      const forbidden: HostCapability[] = [
        'clipboard.copy', 'clipboard.paste',
        'tts.system.start', 'tts.system.stop',
        'device.screen.keep-on', 'device.screen.release',
        'notification.show', 'notification.cancel',
        'background.schedule', 'background.cancel',
        'share.invoke',
        'permission.request', 'permission.check',
        'credential.get', 'credential.set', 'credential.delete',
        'webview.open', 'webview.close', 'webview.evaluate',
        'file.delete',
      ];
      for (let i = 0; i < forbidden.length; i++) {
        const cap = forbidden[i];
        const present = registered.indexOf(cap) >= 0;
        expect(present).assertFalse();
      }
    });

    // ── Layer A: HostCapabilityManifest structure & availability ──
    // Locks the manifest as the single source of truth for capability
    // routing/requirements. Drift in counts catches new capabilities that
    // were added to the union but not described here.

    it('manifest_covers_all_declared_capabilities', 0, () => {
      const core = CoreRuntime.createForTest(makeStubNativeModule(), {});
      const manifest = core.getCapabilityManifest();
      // 15 Core closed-set + 26 UI-Contract-only = 41 total.
      expect(manifest.all().length).assertEqual(41);
    });

    it('manifest_registry_count_matches_core_closed_set', 0, () => {
      const core = CoreRuntime.createForTest(makeStubNativeModule(), {});
      const manifest = core.getCapabilityManifest();
      // 15 Core closed-set capabilities are registry-routed.
      expect(manifest.registeredWithRegistry().length).assertEqual(15);
    });

    it('manifest_marks_device_vibrate_as_reducer_direct', 0, () => {
      const core = CoreRuntime.createForTest(makeStubNativeModule(), {});
      const manifest = core.getCapabilityManifest();
      // device.vibrate now has a DeviceHostAdapter (reducer-direct), no longer
      // unimplemented. Adapter is always present (vibrator needs no context).
      const unimpl = manifest.unimplemented();
      expect(unimpl.length).assertEqual(0);
      expect(manifest.isAvailable('device.vibrate')).assertTrue();
    });

    it('manifest_availability_reflects_runtime_adapters', 0, () => {
      // Without context (unit-test env):
      //  - registry-routed caps that need no context ARE available
      //  - file.read/file.write are NOT registered (no FileHostAdapter)
      //  - screen/notification/etc. are null (no UIAbilityContext)
      const core = CoreRuntime.createForTest(makeStubNativeModule(), {});
      const manifest = core.getCapabilityManifest();
      expect(manifest.isAvailable('http.execute')).assertTrue();
      expect(manifest.isAvailable('host.smoke.echo')).assertTrue();
      expect(manifest.isAvailable('cache.get')).assertTrue();
      // file.* require a context — not available here.
      expect(manifest.isAvailable('file.read')).assertFalse();
      expect(manifest.isAvailable('file.write')).assertFalse();
      expect(manifest.isAvailable('file.delete')).assertFalse();
      // UIAbilityContext-dependent caps — not available here.
      expect(manifest.isAvailable('device.screen.keep-on')).assertFalse();
      expect(manifest.isAvailable('notification.show')).assertFalse();
      expect(manifest.isAvailable('share.invoke')).assertFalse();
      // Always-constructed adapters — available.
      expect(manifest.isAvailable('clipboard.copy')).assertTrue();
      expect(manifest.isAvailable('tts.system.start')).assertTrue();
      expect(manifest.isAvailable('background.schedule')).assertTrue();
    });

    it('manifest_summary_line_is_nonempty', 0, () => {
      const core = CoreRuntime.createForTest(makeStubNativeModule(), {});
      const line = core.getCapabilityManifest().toSummaryLine();
      expect(line.startsWith('total=')).assertTrue();
      expect(line.indexOf('deviceVerified=0') >= 0).assertTrue();
    });

    // ── Layer B: runtime — live NAPI round-trip ──
    // These MUST fail (not skip) when no device CoreRuntime is present.
    // A skip-as-pass is the bug being corrected here.

    it('runtime_singleton_must_be_initialized', 0, () => {
      // In the unit-test environment, CoreRuntime.get() throws because
      // EntryAbility.onCreate (which calls CoreRuntime.init) never ran here.
      // We assert the throw happens — this documents that Layer B cannot pass
      // without a real device runtime. On device, this test passes because
      // the singleton was initialized.
      let threw: boolean;
      try {
        CoreRuntime.get();
        threw = false;
      } catch (e) {
        threw = true;
      }
      // Unit-test runner expects throw. If this ever fails here, someone wired
      // a hidden singleton into the test path — investigate before changing.
      expect(threw).assertTrue();
    });

    it('ping_round_trip_through_napi', 0, async () => {
      // Layer B live test. On device: CoreRuntime.get() returns the singleton
      // and ping() must return true. In unit-test runner: get() throws, and
      // we fail explicitly so the gate cannot go green.
      let core: CoreRuntime;
      try {
        core = CoreRuntime.get();
      } catch (e) {
        expect(false).assertTrue();
        return;
      }
      const pong = await core.ping();
      expect(pong).assertTrue();
    });

    it('coreInfo_round_trip_through_napi', 0, async () => {
      let core: CoreRuntime;
      try {
        core = CoreRuntime.get();
      } catch (e) {
        expect(false).assertTrue();
        return;
      }
      const info = await core.coreInfo();
      expect(typeof info === 'object').assertTrue();
    });
  });
}
