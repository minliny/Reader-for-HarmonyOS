# Host Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立 HarmonyOS Host 基础目录、类型定义、Core Bridge 集成，并实现 http.execute、cookie、webview、file 等核心 Host 能力，最终产出真机证据。

**Architecture:** 分层架构：HostRequest/HostResult/HostError 类型层 → HostDispatcher 调度层 → Core Bridge（NAPI 绑定 + 事件轮询） → CapabilityRouter → 具体 Host Adapter（HttpHostAdapter、CookieHostAdapter、WebViewHostAdapter、FileHostAdapter） → UI/Reducer 消费层。

**Tech Stack:** ArkTS/Stage Model、NAPI (Node-API)、HarmonyOS 网络 API (@ohos.net.http)、ArkWeb (@ohos.web.webview)、Preferences (@ohos.data.preferences)、Download (@ohos.request)。

---

## Phase 0: 依赖配置与目录结构

### Task 0.1: 配置 Reader-Core-Native 依赖

**Files:**
- Create: `entry/libs/libreader_core_napi.so` (预编译共享库)
- Modify: `entry/build-profile.json5:1-29`
- Modify: `entry/oh-package.json5:1-9`
- Create: `entry/src/main/cpp/CMakeLists.txt`

**背景说明：**
- Reader-Core-Native 已提供 Harmony NAPI 绑定（bindings/harmony/native/reader_napi.cpp）
- 需要 libreader_core_napi.so 预编译库（从 Reader-Core-Native target/aarch64-unknown-linux-ohos/release 复制）
- CMakeLists.txt 需链接 reader_core_napi 共享库

- [ ] **Step 1: 复制 Reader-Core-Native 预编译库**

```bash
# 从 Reader-Core-Native 复制预编译的 libreader_core_napi.so
cp /Users/minliny/Documents/Reader-Core-Native/target/aarch64-unknown-linux-ohos/release/libreader_core_napi.so \
   /Users/minliny/Documents/Reader-for-HarmonyOS/entry/libs/
```

Expected: `entry/libs/libreader_core_napi.so` 存在

- [ ] **Step 2: 创建 entry/src/main/cpp 目录**

```bash
mkdir -p /Users/minliny/Documents/Reader-for-HarmonyOS/entry/src/main/cpp
```

Expected: 目录存在

- [ ] **Step 3: 创建 CMakeLists.txt 配置 NAPI 库链接**

```cmake
# entry/src/main/cpp/CMakeLists.txt
cmake_minimum_required(VERSION 3.16)
project(reader_host_bridge)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Link pre-built Reader-Core NAPI library
add_library(reader_core_napi SHARED IMPORTED GLOBAL)
set_target_properties(reader_core_napi PROPERTIES
  IMPORTED_LOCATION "${CMAKE_CURRENT_SOURCE_DIR}/../libs/libreader_core_napi.so")

# Expose to ArkTS via NAPI
find_library(ACE_NAPI_LIB ace_napi.z REQUIRED)

# Host bridge wrapper (future C++ extensions)
add_library(host_bridge SHARED
  host_bridge.cpp)
target_link_libraries(host_bridge PRIVATE
  reader_core_napi
  ${ACE_NAPI_LIB})
```

- [ ] **Step 4: 创建空的 host_bridge.cpp 占位**

```cpp
// entry/src/main/cpp/host_bridge.cpp
#include <node_api.h>

// Placeholder for future Host-specific NAPI extensions
// Current Reader-Core NAPI bindings are self-contained in libreader_core_napi.so

napi_value Init(napi_env env, napi_value exports) {
  return exports;
}

NAPI_MODULE(host_bridge, Init)
```

- [ ] **Step 5: 修改 entry/build-profile.json5 启用 native 构建**

```json5
{
  "apiType": "stageMode",
  "buildOption": {
    "sourceOption": {
      "workers": []
    },
    "externalNativeOptions": {
      "path": "./src/main/cpp/CMakeLists.txt",
      "arguments": "",
      "cppFlags": ""
    }
  },
  // ... rest unchanged
}
```

- [ ] **Step 6: 修改 entry/oh-package.json5 添加依赖声明**

```json5
{
  "name": "entry",
  "version": "1.0.0",
  "description": "Reader for HarmonyOS entry module",
  "main": "",
  "author": "",
  "license": "",
  "dependencies": {
    "@reader/core-harmony": "file:../libs/reader-core-harmony"
  }
}
```

注意：需要先从 Reader-Core-Native 复制 Harmony SDK 作为本地 HAR 依赖。

- [ ] **Step 7: 从 Reader-Core-Native 构建 HAR 包**

```bash
# 在 Reader-Core-Native 目录执行
cd /Users/minliny/Documents/Reader-Core-Native
# 如果有 HAR 构建脚本则执行，否则跳过此步骤
# Harmony HAR 包需要包含 Index.ets + sdk/reader_core.ts
# 由于 Reader-Core-Native 当前只有源码形式，需要在 Reader-for-HarmonyOS 中直接引入源码
```

实际情况：Reader-Core-Native 当前未提供预打包 HAR，需要直接复制源码。

- [ ] **Step 8: 复制 Reader-Core-Native Harmony SDK 源码到 entry/src/main/ets/bridge/**

```bash
mkdir -p /Users/minliny/Documents/Reader-for-HarmonyOS/entry/src/main/ets/bridge/core
cp /Users/minliny/Documents/Reader-Core-Native/bindings/harmony/Index.ets \
   /Users/minliny/Documents/Reader-for-HarmonyOS/entry/src/main/ets/bridge/core/
cp /Users/minliny/Documents/Reader-Core-Native/bindings/harmony/sdk/reader_core.ts \
   /Users/minliny/Documents/Reader-for-HarmonyOS/entry/src/main/ets/bridge/core/sdk/
cp /Users/minliny/Documents/Reader-Core-Native/bindings/harmony/sdk/smoke_report.ts \
   /Users/minliny/Documents/Reader-for-HarmonyOS/entry/src/main/ets/bridge/core/sdk/
```

Expected: `entry/src/main/ets/bridge/core/` 目录包含 Index.ets 和 SDK 文件

- [ ] **Step 9: 修改 Index.ets 导入路径**

```typescript
// entry/src/main/ets/bridge/core/Index.ets
import readerCoreNapi from 'libreader_core_napi.so'; // NAPI 共享库导入

// ... rest of Index.ets content unchanged
```

- [ ] **Step 10: 验证编译**

```bash
cd /Users/minliny/Documents/Reader-for-HarmonyOS
hvigorw assembleHap --no-daemon
```

Expected: BUILD SUCCESSFUL，NAPI 库链接成功

- [ ] **Step 11: Commit**

```bash
git add entry/libs/ entry/src/main/cpp/ entry/src/main/ets/bridge/ entry/build-profile.json5 entry/oh-package.json5
git commit -m "feat: add Reader-Core-Native NAPI dependency and bridge directory"
```

---

## Phase 1: Host 基础类型定义

### Task 1.1: 定义 HostRequest/HostResult/HostError 类型

**Files:**
- Create: `entry/src/main/ets/host/types/HostRequest.ets`
- Create: `entry/src/main/ets/host/types/HostResult.ets`
- Create: `entry/src/main/ets/host/types/HostError.ets`
- Create: `entry/src/main/ets/host/types/index.ets`

- [ ] **Step 1: 创建 HostRequest.ets 定义请求类型**

```typescript
// entry/src/main/ets/host/types/HostRequest.ets
export type HostRequestId = number;
export type HostOperationId = number;

export type HostCapability =
  | 'http.execute'
  | 'cookie.get'
  | 'cookie.set'
  | 'webview.evaluateJavaScript'
  | 'file.read'
  | 'file.write'
  | 'file.delete'
  | 'cache.get'
  | 'cache.set'
  | 'media.download'
  | 'permission.request'
  | 'clipboard.get'
  | 'clipboard.set'
  | 'notification.show'
  | 'background.start'
  | 'background.stop'
  | 'screen.keepOn'
  | 'screen.keepOff'
  | 'tts.speak'
  | 'tts.stop'
  | 'share.open';

export interface HostHttpRequest {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD' | 'OPTIONS' | 'PATCH';
  headers: Record<string, string>;
  body?: string;
  charset?: string;
  followRedirects?: boolean;
  maxRedirects?: number;
  usePlatformCookieJar?: boolean;
  sessionId?: string;
}

export interface HostCookieGetRequest {
  url?: string;
  domain?: string;
  name?: string;
  sessionId?: string;
}

export interface HostCookieSetRequest {
  cookie: {
    name: string;
    value: string;
    domain?: string;
    path?: string;
    expires?: number;
    secure?: boolean;
    httpOnly?: boolean;
  };
  sessionId?: string;
}

export interface HostWebViewEvaluateJavaScriptRequest {
  document: string; // URL or HTML content
  script: string;
  timeoutMillis?: number;
  profileId?: string;
}

export interface HostFileReadRequest {
  path: string;
  encoding?: 'utf-8' | 'binary';
}

export interface HostFileWriteRequest {
  path: string;
  content: string | Uint8Array;
  encoding?: 'utf-8' | 'binary';
}

export interface HostCacheGetRequest {
  key: string;
}

export interface HostCacheSetRequest {
  key: string;
  value: string;
  ttlSeconds?: number;
}

export interface HostMediaDownloadRequest {
  url: string;
  filename: string;
  directory?: 'cache' | 'files';
}

export interface HostPermissionRequest {
  permission: string;
}

export interface HostTtsSpeakRequest {
  text: string;
  rate?: number;
  pitch?: number;
  voice?: string;
}

export interface HostShareOpenRequest {
  text?: string;
  title?: string;
  url?: string;
  files?: string[];
}

export interface HostRequestBase {
  capability: HostCapability;
  operationId: HostOperationId;
  requestId: HostRequestId;
}

export type HostRequestPayloadMap = {
  'http.execute': HostHttpRequest;
  'cookie.get': HostCookieGetRequest;
  'cookie.set': HostCookieSetRequest;
  'webview.evaluateJavaScript': HostWebViewEvaluateJavaScriptRequest;
  'file.read': HostFileReadRequest;
  'file.write': HostFileWriteRequest;
  'file.delete': { path: string };
  'cache.get': HostCacheGetRequest;
  'cache.set': HostCacheSetRequest;
  'media.download': HostMediaDownloadRequest;
  'permission.request': HostPermissionRequest;
  'clipboard.get': {};
  'clipboard.set': { text: string };
  'notification.show': { title: string; body: string };
  'background.start': {};
  'background.stop': {};
  'screen.keepOn': {};
  'screen.keepOff': {};
  'tts.speak': HostTtsSpeakRequest;
  'tts.stop': {};
  'share.open': HostShareOpenRequest;
};

export type HostRequest<K extends HostCapability = HostCapability> =
  HostRequestBase & {
    params: K extends keyof HostRequestPayloadMap ? HostRequestPayloadMap[K] : Record<string, unknown>;
  };
```

- [ ] **Step 2: 创建 HostResult.ets 定义响应类型**

```typescript
// entry/src/main/ets/host/types/HostResult.ets
import { HostCapability, HostOperationId } from './HostRequest';

export interface HostHttpResponse {
  status: number;
  body: string;
  bodyBase64?: string; // 用于二进制内容
  headers?: Record<string, string | string[]>;
  finalUrl?: string;
  charsetHint?: string;
  redirects?: { from: string; to: string; status: number }[];
  cookies?: { name: string; value: string; domain?: string }[];
  sessionId?: string;
}

export interface HostCookieGetResponse {
  cookies: { name: string; value: string; domain?: string; path?: string }[];
}

export interface HostCookieSetResponse {
  stored: boolean;
}

export interface HostWebViewEvaluateJavaScriptResponse {
  result: unknown;
}

export interface HostFileReadResponse {
  content: string | Uint8Array;
  exists: boolean;
  size?: number;
}

export interface HostFileWriteResponse {
  written: boolean;
  bytesWritten?: number;
}

export interface HostFileDeleteResponse {
  deleted: boolean;
}

export interface HostCacheGetResponse {
  value?: string;
  exists: boolean;
}

export interface HostCacheSetResponse {
  stored: boolean;
}

export interface HostMediaDownloadResponse {
  localPath: string;
  completed: boolean;
  progress?: number;
}

export interface HostPermissionResponse {
  granted: boolean;
}

export interface HostClipboardGetResponse {
  text: string;
}

export interface HostClipboardSetResponse {
  set: boolean;
}

export interface HostNotificationShowResponse {
  shown: boolean;
}

export interface HostTtsSpeakResponse {
  speaking: boolean;
}

export interface HostTtsStopResponse {
  stopped: boolean;
}

export interface HostShareOpenResponse {
  shared: boolean;
}

export interface HostBackgroundStartResponse {
  started: boolean;
}

export interface HostBackgroundStopResponse {
  stopped: boolean;
}

export interface HostScreenKeepOnResponse {
  enabled: boolean;
}

export interface HostScreenKeepOffResponse {
  disabled: boolean;
}

export type HostResultPayloadMap = {
  'http.execute': HostHttpResponse;
  'cookie.get': HostCookieGetResponse;
  'cookie.set': HostCookieSetResponse;
  'webview.evaluateJavaScript': HostWebViewEvaluateJavaScriptResponse;
  'file.read': HostFileReadResponse;
  'file.write': HostFileWriteResponse;
  'file.delete': HostFileDeleteResponse;
  'cache.get': HostCacheGetResponse;
  'cache.set': HostCacheSetResponse;
  'media.download': HostMediaDownloadResponse;
  'permission.request': HostPermissionResponse;
  'clipboard.get': HostClipboardGetResponse;
  'clipboard.set': HostClipboardSetResponse;
  'notification.show': HostNotificationShowResponse;
  'background.start': HostBackgroundStartResponse;
  'background.stop': HostBackgroundStopResponse;
  'screen.keepOn': HostScreenKeepOnResponse;
  'screen.keepOff': HostScreenKeepOffResponse;
  'tts.speak': HostTtsSpeakResponse;
  'tts.stop': HostTtsStopResponse;
  'share.open': HostShareOpenResponse;
};

export type HostResult<K extends HostCapability = HostCapability> =
  K extends keyof HostResultPayloadMap ? HostResultPayloadMap[K] : Record<string, unknown>;

export interface HostCompletePayload<K extends HostCapability = HostCapability> {
  operationId: HostOperationId;
  result: HostResult<K>;
}
```

- [ ] **Step 3: 创建 HostError.ets 定义错误类型**

```typescript
// entry/src/main/ets/host/types/HostError.ets
import { HostOperationId } from './HostRequest';

export type HostErrorCode =
  | 'HTTP_TRANSPORT_TIMEOUT'
  | 'HTTP_TRANSPORT_DNS'
  | 'HTTP_TRANSPORT_TLS'
  | 'HTTP_TRANSPORT_CONNECT'
  | 'HTTP_TRANSPORT_HTTP_STATUS'
  | 'HTTP_TRANSPORT_CANCELED'
  | 'CAPABILITY_UNAVAILABLE'
  | 'PERMISSION_DENIED'
  | 'FILE_NOT_FOUND'
  | 'FILE_PERMISSION_DENIED'
  | 'CACHE_MISS'
  | 'WEBVIEW_LOAD_FAILED'
  | 'WEBVIEW_SCRIPT_ERROR'
  | 'WEBVIEW_TIMEOUT'
  | 'TTS_UNAVAILABLE'
  | 'TTS_ERROR'
  | 'DOWNLOAD_FAILED'
  | 'INTERNAL';

export interface HostErrorDetails {
  phase?: 'Transport' | 'Runtime' | 'Script' | 'Storage' | 'Permission' | 'System';
  url?: string;
  finalUrl?: string;
  status?: number;
  challengeKind?: 'captcha' | 'login' | 'cloudflare' | 'unknown';
  loginRequired?: boolean;
  permission?: string;
  path?: string;
  script?: string;
  timeoutMs?: number;
  retryable?: boolean;
}

export interface HostError {
  code: HostErrorCode;
  message: string;
  retryable: boolean;
  details?: HostErrorDetails;
}

export interface HostErrorPayload {
  operationId: HostOperationId;
  error: HostError;
}

export function isTransportError(code: HostErrorCode): boolean {
  return code.startsWith('HTTP_TRANSPORT_');
}

export function isRetryableTransportError(code: HostErrorCode): boolean {
  return code === 'HTTP_TRANSPORT_TIMEOUT' ||
         code === 'HTTP_TRANSPORT_DNS' ||
         code === 'HTTP_TRANSPORT_CONNECT';
}

export function createTransportTimeoutError(url: string, phase: 'connect' | 'read'): HostError {
  return {
    code: 'HTTP_TRANSPORT_TIMEOUT',
    message: `${phase} timed out`,
    retryable: true,
    details: { phase: 'Transport', url },
  };
}

export function createTransportDnsError(url: string): HostError {
  return {
    code: 'HTTP_TRANSPORT_DNS',
    message: 'DNS resolution failed',
    retryable: true,
    details: { phase: 'Transport', url },
  };
}

export function createTransportTlsError(url: string, reason: string): HostError {
  return {
    code: 'HTTP_TRANSPORT_TLS',
    message: reason,
    retryable: false,
    details: { phase: 'Transport', url },
  };
}

export function createCapabilityUnavailableError(capability: string): HostError {
  return {
    code: 'CAPABILITY_UNAVAILABLE',
    message: `Capability '${capability}' not available on this platform`,
    retryable: false,
    details: { phase: 'Runtime' },
  };
}

export function createFileNotFoundError(path: string): HostError {
  return {
    code: 'FILE_NOT_FOUND',
    message: `File not found: ${path}`,
    retryable: false,
    details: { phase: 'Storage', path },
  };
}

export function createWebViewTimeoutError(url: string, timeoutMs: number): HostError {
  return {
    code: 'WEBVIEW_TIMEOUT',
    message: 'WebView operation timed out',
    retryable: true,
    details: { phase: 'Script', url, timeoutMs },
  };
}
```

- [ ] **Step 4: 创建 index.ets 导出所有类型**

```typescript
// entry/src/main/ets/host/types/index.ets
export * from './HostRequest';
export * from './HostResult';
export * from './HostError';
```

- [ ] **Step 5: 验证编译**

```bash
hvigorw assembleHap --no-daemon
```

Expected: BUILD SUCCESSFUL

- [ ] **Step 6: Commit**

```bash
git add entry/src/main/ets/host/types/
git commit -m "feat: define HostRequest/HostResult/HostError types"
```

---

## Phase 2: HostDispatcher 与 CapabilityRegistry

### Task 2.1: 实现 HostCapabilityRegistry

**Files:**
- Create: `entry/src/main/ets/host/HostCapabilityRegistry.ets`

- [ ] **Step 1: 创建 HostCapabilityRegistry.ets 注册能力处理器**

```typescript
// entry/src/main/ets/host/HostCapabilityRegistry.ets
import {
  HostCapability,
  HostRequest,
  HostResult,
  HostError,
} from './types';
import {
  ReaderCoreHostRequestEvent,
  JsonObject,
} from '../bridge/core/sdk/reader_core';

export type HostCapabilityHandler = (
  event: ReaderCoreHostRequestEvent
) => Promise<JsonObject> | JsonObject;

export class HostCapabilityRegistry {
  private handlers = new Map<HostCapability, HostCapabilityHandler>();

  register(capability: HostCapability, handler: HostCapabilityHandler): void {
    if (typeof capability !== 'string' || capability.length === 0) {
      throw new Error('capability must be a non-empty string');
    }
    if (typeof handler !== 'function') {
      throw new Error('handler must be a function');
    }
    this.handlers.set(capability, handler);
  }

  unregister(capability: HostCapability): void {
    this.handlers.delete(capability);
  }

  has(capability: HostCapability): boolean {
    return this.handlers.has(capability);
  }

  get(capability: HostCapability): HostCapabilityHandler | undefined {
    return this.handlers.get(capability);
  }

  async dispatch(event: ReaderCoreHostRequestEvent): Promise<JsonObject> {
    const handler = this.handlers.get(event.capability as HostCapability);
    if (handler === undefined) {
      throw new Error(`No handler registered for capability: ${event.capability}`);
    }
    return handler(event);
  }

  getRegisteredCapabilities(): HostCapability[] {
    return Array.from(this.handlers.keys());
  }
}
```

- [ ] **Step 2: 验证编译**

```bash
hvigorw assembleHap --no-daemon
```

Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add entry/src/main/ets/host/HostCapabilityRegistry.ets
git commit -m "feat: implement HostCapabilityRegistry"
```

---

### Task 2.2: 实现 HostDispatcher

**Files:**
- Create: `entry/src/main/ets/host/HostDispatcher.ets`
- Create: `entry/src/main/ets/host/index.ets`

- [ ] **Step 1: 创建 HostDispatcher.ets 调度 Host 请求**

```typescript
// entry/src/main/ets/host/HostDispatcher.ets
import {
  ReaderCoreRuntime,
  ReaderCoreHostRequestEvent,
  JsonObject,
  ReaderCoreError,
} from '../bridge/core/sdk/reader_core';
import { HostCapabilityRegistry } from './HostCapabilityRegistry';
import {
  HostCapability,
  HostError,
  HostErrorCode,
  createCapabilityUnavailableError,
} from './types';

export interface HostDispatcherConfig {
  runtime: ReaderCoreRuntime;
  registry: HostCapabilityRegistry;
  pollIntervalMs?: number;
}

export class HostDispatcher {
  private runtime: ReaderCoreRuntime;
  private registry: HostCapabilityRegistry;
  private pollIntervalMs: number;
  private running = false;
  private pollTimer?: number;

  constructor(config: HostDispatcherConfig) {
    this.runtime = config.runtime;
    this.registry = config.registry;
    this.pollIntervalMs = config.pollIntervalMs ?? 10;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.pollLoop();
  }

  stop(): void {
    this.running = false;
    if (this.pollTimer !== undefined) {
      clearTimeout(this.pollTimer);
      this.pollTimer = undefined;
    }
  }

  private pollLoop(): void {
    if (!this.running) return;

    try {
      const event = this.runtime.readEvent(this.pollIntervalMs);
      if (event !== null && event.type === 'host.request') {
        this.handleHostRequest(event);
      }
    } catch (e) {
      // Log error but continue polling
      console.error('HostDispatcher poll error:', e);
    }

    if (this.running) {
      this.pollTimer = setTimeout(() => this.pollLoop(), 0);
    }
  }

  private async handleHostRequest(event: ReaderCoreHostRequestEvent): Promise<void> {
    const capability = event.capability as HostCapability;
    try {
      const result = await this.registry.dispatch(event);
      this.runtime.completeHostRequest(event, result);
    } catch (e) {
      const error = this.normalizeError(e, capability);
      this.runtime.failHostRequest(event, error);
    }
  }

  private normalizeError(e: unknown, capability: HostCapability): ReaderCoreError {
    if (e instanceof Error) {
      const message = e.message;
      if (message.startsWith('No handler registered')) {
        return {
          code: 'CAPABILITY_UNAVAILABLE',
          message: message,
          retryable: false,
        };
      }
      return {
        code: 'INTERNAL',
        message: message,
        retryable: false,
        details: { name: e.name, capability },
      };
    }

    return {
      code: 'INTERNAL',
      message: typeof e === 'string' ? e : 'Host request failed',
      retryable: false,
    };
  }
}
```

- [ ] **Step 2: 创建 host/index.ets 导出**

```typescript
// entry/src/main/ets/host/index.ets
export * from './types';
export { HostCapabilityRegistry } from './HostCapabilityRegistry';
export { HostDispatcher } from './HostDispatcher';
export type { HostDispatcherConfig } from './HostDispatcher';
export type { HostCapabilityHandler } from './HostCapabilityRegistry';
```

- [ ] **Step 3: 验证编译**

```bash
hvigorw assembleHap --no-daemon
```

Expected: BUILD SUCCESSFUL

- [ ] **Step 4: Commit**

```bash
git add entry/src/main/ets/host/HostDispatcher.ets entry/src/main/ets/host/index.ets
git commit -m "feat: implement HostDispatcher for host.request routing"
```

---

## Phase 3: Core Runtime 初始化

### Task 3.1: 创建 CoreRuntime 单例

**Files:**
- Create: `entry/src/main/ets/bridge/CoreRuntime.ets`
- Modify: `entry/src/main/ets/entryability/EntryAbility.ets:1-73`

- [ ] **Step 1: 创建 CoreRuntime.ets 初始化 ReaderCoreRuntime**

```typescript
// entry/src/main/ets/bridge/CoreRuntime.ets
import {
  ReaderCoreRuntime,
  CapabilityRouter,
  JsonObject,
  NativeReaderCoreModule,
} from './core/sdk/reader_core';
import { HostCapabilityRegistry, HostDispatcher } from '../host';
import { HttpHostAdapter } from '../host/adapters/HttpHostAdapter';

// NAPI module import (linked via libreader_core_napi.so)
import readerCoreNapi from 'libreader_core_napi.so';

const nativeModule = readerCoreNapi as NativeReaderCoreModule;

export class CoreRuntime {
  private static instance: CoreRuntime | null = null;
  private runtime: ReaderCoreRuntime;
  private registry: HostCapabilityRegistry;
  private dispatcher: HostDispatcher;

  private constructor(config: JsonObject = {}) {
    this.runtime = new ReaderCoreRuntime(nativeModule, config);
    this.registry = new HostCapabilityRegistry();
    this.dispatcher = new HostDispatcher({
      runtime: this.runtime,
      registry: this.registry,
    });
  }

  static init(config: JsonObject = {}): CoreRuntime {
    if (CoreRuntime.instance !== null) {
      throw new Error('CoreRuntime already initialized');
    }
    CoreRuntime.instance = new CoreRuntime(config);
    return CoreRuntime.instance;
  }

  static get(): CoreRuntime {
    if (CoreRuntime.instance === null) {
      throw new Error('CoreRuntime not initialized');
    }
    return CoreRuntime.instance;
  }

  static close(): void {
    if (CoreRuntime.instance !== null) {
      CoreRuntime.instance.dispatcher.stop();
      CoreRuntime.instance.runtime.close();
      CoreRuntime.instance = null;
    }
  }

  getReaderCoreRuntime(): ReaderCoreRuntime {
    return this.runtime;
  }

  getRegistry(): HostCapabilityRegistry {
    return this.registry;
  }

  startDispatcher(): void {
    this.dispatcher.start();
  }

  stopDispatcher(): void {
    this.dispatcher.stop();
  }

  async ping(): Promise<boolean> {
    try {
      await this.runtime.ping();
      return true;
    } catch {
      return false;
    }
  }

  async coreInfo(): Promise<JsonObject> {
    const event = await this.runtime.coreInfo();
    return event.data;
  }
}
```

- [ ] **Step 2: 修改 EntryAbility.ets 初始化 CoreRuntime**

```typescript
// entry/src/main/ets/entryability/EntryAbility.ets
import UIAbility from '@ohos.app.ability.UIAbility';
import window from '@ohos.window';
import display from '@ohos.display';
import { ReaderUiStore } from '../ui/store/ReaderUiStore';
import { SafeAreaAdapter } from '../ui/adapters/SafeAreaAdapter';
import { ColorTokens } from '../contract/generated/ColorTokens';
import { CoreRuntime } from '../bridge/CoreRuntime';

export default class EntryAbility extends UIAbility {
  onCreate(): void {
    ReaderUiStore.init();
    // Seed demo fallback insets
    AppStorage.setOrCreate<number>(SafeAreaAdapter.K_TOP, SafeAreaAdapter.DEFAULT_TOP);
    AppStorage.setOrCreate<number>(SafeAreaAdapter.K_BOTTOM, SafeAreaAdapter.DEFAULT_BOTTOM);
    AppStorage.setOrCreate<number>(SafeAreaAdapter.K_START, SafeAreaAdapter.DEFAULT_START);
    AppStorage.setOrCreate<number>(SafeAreaAdapter.K_END, SafeAreaAdapter.DEFAULT_END);
    // Initialize CoreRuntime
    try {
      const core = CoreRuntime.init({
        dataDir: this.context.filesDir,
        cacheDir: this.context.cacheDir,
      });
      core.startDispatcher();
    } catch (e) {
      console.error('CoreRuntime init failed:', e);
    }
  }

  onDestroy(): void {
    CoreRuntime.close();
  }

  async onWindowStageCreate(windowStage: window.WindowStage): Promise<void> {
    // ... existing immersive setup code unchanged
    try {
      const win = await windowStage.getMainWindow();
      await win.setWindowLayoutFullScreen(true);
      await win.setWindowSystemBarProperties({
        statusBarColor: SafeAreaAdapter.SYSTEM_BAR_TRANSPARENT,
        statusBarContentColor: ColorTokens.ink,
        navigationBarColor: SafeAreaAdapter.SYSTEM_BAR_TRANSPARENT,
        navigationBarContentColor: ColorTokens.ink,
      });
      this.applyAvoidArea(await win.getWindowAvoidArea(window.AvoidAreaType.TYPE_SYSTEM));
      win.on('avoidAreaChange', (data: window.AvoidAreaOptions) => {
        this.applyAvoidArea(data.area);
      });
    } catch (e) {
      // Best-effort immersive setup
    }
    try {
      windowStage.loadContent('pages/Index');
    } catch (e) {
      // fatal
    }
  }

  private applyAvoidArea(area: window.AvoidArea): void {
    try {
      const d = display.getDefaultDisplaySync().densityPixels;
      AppStorage.setOrCreate<number>(SafeAreaAdapter.K_TOP, area.topRect.height / d);
      AppStorage.setOrCreate<number>(SafeAreaAdapter.K_BOTTOM, area.bottomRect.height / d);
      AppStorage.setOrCreate<number>(SafeAreaAdapter.K_START, area.leftRect.width / d);
      AppStorage.setOrCreate<number>(SafeAreaAdapter.K_END, area.rightRect.width / d);
    } catch (e) {
      // keep previous insets
    }
  }
}
```

- [ ] **Step 3: 验证编译**

```bash
hvigorw assembleHap --no-daemon
```

Expected: BUILD SUCCESSFUL

- [ ] **Step 4: Commit**

```bash
git add entry/src/main/ets/bridge/CoreRuntime.ets entry/src/main/ets/entryability/EntryAbility.ets
git commit -m "feat: create CoreRuntime singleton and init in EntryAbility"
```

---

## Phase 4: HttpHostAdapter 实现

### Task 4.1: 实现 HttpHostAdapter

**Files:**
- Create: `entry/src/main/ets/host/adapters/HttpHostAdapter.ets`
- Create: `entry/src/main/ets/host/adapters/index.ets`

- [ ] **Step 1: 创建 HttpHostAdapter.ets 实现 HTTP 执行**

```typescript
// entry/src/main/ets/host/adapters/HttpHostAdapter.ets
import http from '@ohos.net.http';
import {
  ReaderCoreHostRequestEvent,
  JsonObject,
} from '../../bridge/core/sdk/reader_core';
import {
  HostHttpRequest,
  HostHttpResponse,
  HostError,
  createTransportTimeoutError,
  createTransportDnsError,
  createTransportTlsError,
} from '../types';

export class HttpHostAdapter {
  private httpClient: http.HttpClient;

  constructor() {
    this.httpClient = http.createHttp();
  }

  async execute(event: ReaderCoreHostRequestEvent): Promise<JsonObject> {
    const params = event.params as HostHttpRequest;
    const url = params.url;
    const method = this.normalizeMethod(params.method);

    try {
      const response = await this.httpClient.request(url, {
        method: method,
        header: params.headers,
        extraData: params.body,
        expectDataType: http.HttpDataType.STRING,
        connectTimeout: 30000,
        readTimeout: 30000,
      });

      const result: HostHttpResponse = {
        status: response.responseCode,
        body: response.result as string,
        headers: this.extractHeaders(response.header),
        finalUrl: url, // HarmonyOS http 模块不自动暴露 finalUrl，需手动处理
      };

      return result as unknown as JsonObject;
    } catch (e) {
      throw this.translateHttpError(e, url);
    }
  }

  private normalizeMethod(method: string): http.HttpRequestMethod {
    switch (method) {
      case 'GET': return http.HttpRequestMethod.GET;
      case 'POST': return http.HttpRequestMethod.POST;
      case 'PUT': return http.HttpRequestMethod.PUT;
      case 'DELETE': return http.HttpRequestMethod.DELETE;
      case 'HEAD': return http.HttpRequestMethod.HEAD;
      case 'OPTIONS': return http.HttpRequestMethod.OPTIONS;
      case 'PATCH': return http.HttpRequestMethod.POST; // PATCH via POST
      default: return http.HttpRequestMethod.GET;
    }
  }

  private extractHeaders(header: http.HttpHeader): Record<string, string> {
    const result: Record<string, string> = {};
    if (header && typeof header === 'object') {
      for (const [key, value] of Object.entries(header)) {
        result[key] = String(value);
      }
    }
    return result;
  }

  private translateHttpError(e: unknown, url: string): HostError {
    if (e instanceof Error) {
      const message = e.message;
      if (message.includes('timeout') || message.includes('Timeout')) {
        return createTransportTimeoutError(url, 'connect');
      }
      if (message.includes('DNS') || message.includes('dns')) {
        return createTransportDnsError(url);
      }
      if (message.includes('TLS') || message.includes('SSL') || message.includes('certificate')) {
        return createTransportTlsError(url, message);
      }
      return {
        code: 'HTTP_TRANSPORT_CONNECT',
        message: message,
        retryable: true,
        details: { phase: 'Transport', url },
      };
    }
    return {
      code: 'INTERNAL',
      message: typeof e === 'string' ? e : 'HTTP request failed',
      retryable: false,
    };
  }

  destroy(): void {
    this.httpClient.destroy();
  }
}
```

- [ ] **Step 2: 注册 HttpHostAdapter 到 CoreRuntime**

```typescript
// entry/src/main/ets/bridge/CoreRuntime.ets (追加)
import { HttpHostAdapter } from '../host/adapters/HttpHostAdapter';

// 在 constructor 中注册
private constructor(config: JsonObject = {}) {
  this.runtime = new ReaderCoreRuntime(nativeModule, config);
  this.registry = new HostCapabilityRegistry();
  this.dispatcher = new HostDispatcher({
    runtime: this.runtime,
    registry: this.registry,
  });
  // Register HTTP adapter
  const httpAdapter = new HttpHostAdapter();
  this.registry.register('http.execute', (event) => httpAdapter.execute(event));
}
```

- [ ] **Step 3: 创建 adapters/index.ets 导出**

```typescript
// entry/src/main/ets/host/adapters/index.ets
export { HttpHostAdapter } from './HttpHostAdapter';
```

- [ ] **Step 4: 验证编译**

```bash
hvigorw assembleHap --no-daemon
```

Expected: BUILD SUCCESSFUL

- [ ] **Step 5: Commit**

```bash
git add entry/src/main/ets/host/adapters/ entry/src/main/ets/bridge/CoreRuntime.ets
git commit -m "feat: implement HttpHostAdapter with HarmonyOS @ohos.net.http"
```

---

## Phase 5: CookieHostAdapter 实现

### Task 5.1: 实现 CookieHostAdapter

**Files:**
- Create: `entry/src/main/ets/host/adapters/CookieHostAdapter.ets`

- [ ] **Step 1: 创建 CookieHostAdapter.ets 实现作用域 Cookie Jar**

```typescript
// entry/src/main/ets/host/adapters/CookieHostAdapter.ets
import {
  ReaderCoreHostRequestEvent,
  JsonObject,
} from '../../bridge/core/sdk/reader_core';
import {
  HostCookieGetRequest,
  HostCookieGetResponse,
  HostCookieSetRequest,
  HostCookieSetResponse,
  HostError,
  createCapabilityUnavailableError,
} from '../types';

// HarmonyOS Cookie 管理暂用内存 jar（WebView cookie 通过 ArkWeb API）
// 未来可接入 Preferences 持久化

interface CookieEntry {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  secure: boolean;
  httpOnly: boolean;
}

export class CookieHostAdapter {
  private jars = new Map<string, CookieEntry[]>();

  async get(event: ReaderCoreHostRequestEvent): Promise<JsonObject> {
    const params = event.params as HostCookieGetRequest;
    const sessionId = params.sessionId ?? 'default';
    const jar = this.jars.get(sessionId) ?? [];

    const filtered = jar.filter(cookie => {
      if (params.name && cookie.name !== params.name) return false;
      if (params.domain && !this.matchesDomain(cookie.domain, params.domain)) return false;
      if (params.url) {
        const urlDomain = this.extractDomain(params.url);
        if (!this.matchesDomain(cookie.domain, urlDomain)) return false;
      }
      return true;
    });

    const result: HostCookieGetResponse = {
      cookies: filtered.map(c => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
      })),
    };
    return result as unknown as JsonObject;
  }

  async set(event: ReaderCoreHostRequestEvent): Promise<JsonObject> {
    const params = event.params as HostCookieSetRequest;
    const sessionId = params.sessionId ?? 'default';
    const cookie = params.cookie;

    let jar = this.jars.get(sessionId);
    if (jar === undefined) {
      jar = [];
      this.jars.set(sessionId, jar);
    }

    const entry: CookieEntry = {
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain ?? '',
      path: cookie.path ?? '/',
      expires: cookie.expires,
      secure: cookie.secure ?? false,
      httpOnly: cookie.httpOnly ?? false,
    };

    // Remove existing cookie with same name/domain/path
    const existingIndex = jar.findIndex(c =>
      c.name === entry.name &&
      c.domain === entry.domain &&
      c.path === entry.path
    );
    if (existingIndex >= 0) {
      jar.splice(existingIndex, 1);
    }

    jar.push(entry);
    const result: HostCookieSetResponse = { stored: true };
    return result as unknown as JsonObject;
  }

  private matchesDomain(cookieDomain: string, requestDomain: string): boolean {
    if (cookieDomain === requestDomain) return true;
    if (cookieDomain.startsWith('.') && requestDomain.endsWith(cookieDomain.slice(1))) return true;
    return false;
  }

  private extractDomain(url: string): string {
    try {
      const match = url.match(/^https?:\/\/([^/]+)/);
      return match ? match[1] : '';
    } catch {
      return '';
    }
  }

  clearSession(sessionId: string): void {
    this.jars.delete(sessionId);
  }
}
```

- [ ] **Step 2: 注册 CookieHostAdapter**

```typescript
// entry/src/main/ets/bridge/CoreRuntime.ets (追加)
import { CookieHostAdapter } from '../host/adapters/CookieHostAdapter';

// 在 constructor 中注册
const cookieAdapter = new CookieHostAdapter();
this.registry.register('cookie.get', (event) => cookieAdapter.get(event));
this.registry.register('cookie.set', (event) => cookieAdapter.set(event));
```

- [ ] **Step 3: 验证编译**

```bash
hvigorw assembleHap --no-daemon
```

Expected: BUILD SUCCESSFUL

- [ ] **Step 4: Commit**

```bash
git add entry/src/main/ets/host/adapters/CookieHostAdapter.ets entry/src/main/ets/bridge/CoreRuntime.ets
git commit -m "feat: implement CookieHostAdapter with scoped memory jar"
```

---

## Phase 6: WebViewHostAdapter 实现

### Task 6.1: 实现 WebViewHostAdapter

**Files:**
- Create: `entry/src/main/ets/host/adapters/WebViewHostAdapter.ets`

**背景说明：**
- HarmonyOS WebView API: @ohos.web.webview
- 需要 Web 组件 + controller + javaScriptAccess
- 仅实现 evaluateJavaScript，不实现完整 WebView UI（UI 层负责）

- [ ] **Step 1: 创建 WebViewHostAdapter.ets 实现 JS 执行**

```typescript
// entry/src/main/ets/host/adapters/WebViewHostAdapter.ets
import webview from '@ohos.web.webview';
import {
  ReaderCoreHostRequestEvent,
  JsonObject,
} from '../../bridge/core/sdk/reader_core';
import {
  HostWebViewEvaluateJavaScriptRequest,
  HostWebViewEvaluateJavaScriptResponse,
  HostError,
  createWebViewTimeoutError,
} from '../types';

export class WebViewHostAdapter {
  // WebView 需要实际的 Web 组件实例，这里只提供 controller 接口
  // 真正的 WebView UI 由 ReaderWebView 组件负责（见 Phase 8）

  private controllers = new Map<string, webview.WebviewController>();

  registerController(profileId: string, controller: webview.WebviewController): void {
    this.controllers.set(profileId, controller);
  }

  unregisterController(profileId: string): void {
    this.controllers.delete(profileId);
  }

  async evaluateJavaScript(event: ReaderCoreHostRequestEvent): Promise<JsonObject> {
    const params = event.params as HostWebViewEvaluateJavaScriptRequest;
    const profileId = params.profileId ?? 'default';
    const controller = this.controllers.get(profileId);

    if (controller === undefined) {
      throw new Error(`No WebView controller registered for profileId: ${profileId}`);
    }

    try {
      const result = await controller.runJavaScript(params.script);
      const response: HostWebViewEvaluateJavaScriptResponse = {
        result: result,
      };
      return response as unknown as JsonObject;
    } catch (e) {
      if (e instanceof Error) {
        if (e.message.includes('timeout')) {
          throw createWebViewTimeoutError(params.document, params.timeoutMillis ?? 5000);
        }
        throw {
          code: 'WEBVIEW_SCRIPT_ERROR',
          message: e.message,
          retryable: false,
          details: { phase: 'Script', script: params.script },
        } as HostError;
      }
      throw {
        code: 'INTERNAL',
        message: 'WebView JavaScript execution failed',
        retryable: false,
      } as HostError;
    }
  }
}
```

- [ ] **Step 2: 注册 WebViewHostAdapter**

```typescript
// entry/src/main/ets/bridge/CoreRuntime.ets (追加)
import { WebViewHostAdapter } from '../host/adapters/WebViewHostAdapter';

// 在 constructor 中注册
const webViewAdapter = new WebViewHostAdapter();
this.registry.register('webview.evaluateJavaScript', (event) => webViewAdapter.evaluateJavaScript(event));
```

- [ ] **Step 3: 验证编译**

```bash
hvigorw assembleHap --no-daemon
```

Expected: BUILD SUCCESSFUL

- [ ] **Step 4: Commit**

```bash
git add entry/src/main/ets/host/adapters/WebViewHostAdapter.ets entry/src/main/ets/bridge/CoreRuntime.ets
git commit -m "feat: implement WebViewHostAdapter with @ohos.web.webview"
```

---

## Phase 7: FileHostAdapter 实现

### Task 7.1: 实现 FileHostAdapter

**Files:**
- Create: `entry/src/main/ets/host/adapters/FileHostAdapter.ets`

- [ ] **Step 1: 创建 FileHostAdapter.ets 实现文件读写**

```typescript
// entry/src/main/ets/host/adapters/FileHostAdapter.ets
import fs from '@ohos.file.fs';
import {
  ReaderCoreHostRequestEvent,
  JsonObject,
} from '../../bridge/core/sdk/reader_core';
import {
  HostFileReadRequest,
  HostFileReadResponse,
  HostFileWriteRequest,
  HostFileWriteResponse,
  HostFileDeleteResponse,
  HostError,
  createFileNotFoundError,
} from '../types';

export class FileHostAdapter {
  private context: Context; // UIAbility context

  constructor(context: Context) {
    this.context = context;
  }

  async read(event: ReaderCoreHostRequestEvent): Promise<JsonObject> {
    const params = event.params as HostFileReadRequest;
    const path = this.resolvePath(params.path);

    try {
      const stat = fs.statSync(path);
      const file = fs.openSync(path, fs.OpenMode.READ_ONLY);
      const buffer = new ArrayBuffer(stat.size);
      fs.readSync(file.fd, buffer);
      fs.closeSync(file);

      const encoding = params.encoding ?? 'utf-8';
      const content = encoding === 'binary'
        ? new Uint8Array(buffer)
        : String.fromCharCode(...new Uint8Array(buffer));

      const result: HostFileReadResponse = {
        content: content,
        exists: true,
        size: stat.size,
      };
      return result as unknown as JsonObject;
    } catch (e) {
      if (e instanceof Error && e.message.includes('No such file')) {
        throw createFileNotFoundError(path);
      }
      throw {
        code: 'FILE_PERMISSION_DENIED',
        message: e instanceof Error ? e.message : 'File read failed',
        retryable: false,
        details: { phase: 'Storage', path },
      } as HostError;
    }
  }

  async write(event: ReaderCoreHostRequestEvent): Promise<JsonObject> {
    const params = event.params as HostFileWriteRequest;
    const path = this.resolvePath(params.path);
    const encoding = params.encoding ?? 'utf-8';

    try {
      const content = typeof params.content === 'string'
        ? params.content
        : params.content;
      const buffer = encoding === 'binary' && typeof content !== 'string'
        ? content
        : new Uint8Array([...(content as string)].map(c => c.charCodeAt(0)));

      const file = fs.openSync(path, fs.OpenMode.CREATE | fs.OpenMode.WRITE_ONLY);
      const bytesWritten = fs.writeSync(file.fd, buffer);
      fs.closeSync(file);

      const result: HostFileWriteResponse = {
        written: true,
        bytesWritten: bytesWritten,
      };
      return result as unknown as JsonObject;
    } catch (e) {
      throw {
        code: 'FILE_PERMISSION_DENIED',
        message: e instanceof Error ? e.message : 'File write failed',
        retryable: false,
        details: { phase: 'Storage', path },
      } as HostError;
    }
  }

  async delete(event: ReaderCoreHostRequestEvent): Promise<JsonObject> {
    const params = event.params as { path: string };
    const path = this.resolvePath(params.path);

    try {
      fs.unlinkSync(path);
      const result: HostFileDeleteResponse = { deleted: true };
      return result as unknown as JsonObject;
    } catch (e) {
      const result: HostFileDeleteResponse = { deleted: false };
      return result as unknown as JsonObject;
    }
  }

  private resolvePath(path: string): string {
    // 支持 'files://' 和 'cache://' 前缀
    if (path.startsWith('files://')) {
      return this.context.filesDir + '/' + path.slice(8);
    }
    if (path.startsWith('cache://')) {
      return this.context.cacheDir + '/' + path.slice(8);
    }
    return path;
  }
}
```

- [ ] **Step 2: 注册 FileHostAdapter（需要 context）**

```typescript
// entry/src/main/ets/bridge/CoreRuntime.ets (修改 init)
import { FileHostAdapter } from '../host/adapters/FileHostAdapter';

export class CoreRuntime {
  private fileAdapter: FileHostAdapter;

  private constructor(config: JsonObject & { context?: Context }) {
    this.runtime = new ReaderCoreRuntime(nativeModule, config);
    this.registry = new HostCapabilityRegistry();
    this.dispatcher = new HostDispatcher({
      runtime: this.runtime,
      registry: this.registry,
    });

    // HTTP adapter
    const httpAdapter = new HttpHostAdapter();
    this.registry.register('http.execute', (event) => httpAdapter.execute(event));

    // Cookie adapter
    const cookieAdapter = new CookieHostAdapter();
    this.registry.register('cookie.get', (event) => cookieAdapter.get(event));
    this.registry.register('cookie.set', (event) => cookieAdapter.set(event));

    // WebView adapter
    this.webViewAdapter = new WebViewHostAdapter();
    this.registry.register('webview.evaluateJavaScript', (event) => this.webViewAdapter.evaluateJavaScript(event));

    // File adapter (requires context)
    if (config.context) {
      this.fileAdapter = new FileHostAdapter(config.context);
      this.registry.register('file.read', (event) => this.fileAdapter.read(event));
      this.registry.register('file.write', (event) => this.fileAdapter.write(event));
      this.registry.register('file.delete', (event) => this.fileAdapter.delete(event));
    }
  }
}

// EntryAbility.ets 修改
CoreRuntime.init({
  dataDir: this.context.filesDir,
  cacheDir: this.context.cacheDir,
  context: this.context, // 新增 context 传递
});
```

- [ ] **Step 3: 验证编译**

```bash
hvigorw assembleHap --no-daemon
```

Expected: BUILD SUCCESSFUL

- [ ] **Step 4: Commit**

```bash
git add entry/src/main/ets/host/adapters/FileHostAdapter.ets entry/src/main/ets/bridge/CoreRuntime.ets entry/src/main/ets/entryability/EntryAbility.ets
git commit -m "feat: implement FileHostAdapter with @ohos.file.fs"
```

---

## Phase 8: Host Smoke 测试

### Task 8.1: 创建 Host Smoke 测试脚本

**Files:**
- Create: `scripts/host_smoke.mjs`
- Create: `entry/src/main/ets/host/tests/HostSmoke.test.ets`

- [ ] **Step 1: 创建 HostSmoke.test.ets 单元测试**

```typescript
// entry/src/main/ets/host/tests/HostSmoke.test.ets
import { describe, it, expect } from '@ohos/hypium';
import { CoreRuntime } from '../../bridge/CoreRuntime';
import { HostCapabilityRegistry } from '../HostCapabilityRegistry';
import { HttpHostAdapter } from '../adapters/HttpHostAdapter';

export default function HostSmokeTest() {
  describe('HostSmoke', () => {
    it('ping_should_work', async () => {
      const core = CoreRuntime.get();
      const pong = await core.ping();
      expect(pong).assertTrue();
    });

    it('coreInfo_should_return_version', async () => {
      const core = CoreRuntime.get();
      const info = await core.coreInfo();
      expect(info.version).assertNotNull();
    });

    it('registry_should_have_http_execute', () => {
      const core = CoreRuntime.get();
      const registry = core.getRegistry();
      expect(registry.has('http.execute')).assertTrue();
    });

    it('registry_should_have_cookie_get_set', () => {
      const core = CoreRuntime.get();
      const registry = core.getRegistry();
      expect(registry.has('cookie.get')).assertTrue();
      expect(registry.has('cookie.set')).assertTrue();
    });
  });
}
```

- [ ] **Step 2: 注册测试**

```typescript
// entry/src/test/List.test.ets (追加导入)
import HostSmokeTest from '../main/ets/host/tests/HostSmoke.test.ets';

// 在测试列表中添加
HostSmokeTest();
```

- [ ] **Step 3: 运行单元测试**

```bash
hvigorw test
```

Expected: 测试通过，ping、coreInfo、registry 检查全部 PASS

- [ ] **Step 4: 创建 host_smoke.mjs CLI 测试脚本**

```javascript
// scripts/host_smoke.mjs
import { execSync } from 'child_process';

console.log('=== Host Smoke Test ===');

// 1. Build
console.log('Building...');
execSync('hvigorw assembleHap --no-daemon', { stdio: 'inherit' });

// 2. Unit tests
console.log('Running unit tests...');
execSync('hvigorw test', { stdio: 'inherit' });

// 3. Check NAPI library
const fs = require('fs');
const libPath = 'entry/libs/libreader_core_napi.so';
if (!fs.existsSync(libPath)) {
  console.error('❌ libreader_core_napi.so not found');
  process.exit(1);
}
console.log('✅ libreader_core_napi.so exists');

console.log('=== Host Smoke Test Passed ===');
```

- [ ] **Step 5: Commit**

```bash
git add scripts/host_smoke.mjs entry/src/main/ets/host/tests/ entry/src/test/List.test.ets
git commit -m "feat: add Host smoke tests (ping, coreInfo, registry)"
```

---

## Phase 9: 真机证据收集

### Task 9.1: 创建真机 Smoke 证据脚本

**Files:**
- Create: `scripts/device_smoke.sh`
- Create: `docs/evidence/host-device-proof.md`

**背景说明：**
- 需要 hdc (HarmonyOS Device Connector) 工具
- 从 DevEco Studio tools 目录调用
- 真机运行才能证明 Host 真实可用（不能只用 hvigor build）

- [ ] **Step 1: 创建 device_smoke.sh 真机测试脚本**

```bash
#!/bin/bash
# scripts/device_smoke.sh
# HarmonyOS 真机 Host smoke 证据收集

set -e

HDC="/Applications/DevEco-Studio.app/Contents/tools/hdc"
APP_PACKAGE="reader.minliny.testpackage"
HAP_PATH="entry/build/default/outputs/default/entry-default-signed.hap"

echo "=== HarmonyOS Host Device Smoke ==="

# 1. Build signed HAP
echo "Building signed HAP..."
hvigorw assembleHap --mode release -p product=default -p buildMode=release

# 2. Install to device
echo "Installing to device..."
"$HDC" install "$HAP_PATH"

# 3. Launch app
echo "Launching app..."
"$HDC" shell aa start -a EntryAbility -b "$APP_PACKAGE"

# 4. Check app is running
echo "Checking app process..."
PID=$("$HDC" shell pidof "$APP_PACKAGE")
if [ -z "$PID" ]; then
  echo "❌ App not running"
  exit 1
fi
echo "✅ App running with PID: $PID"

# 5. Check CoreRuntime logs
echo "Checking CoreRuntime initialization..."
LOGS=$("$HDC" shell hilog | grep -E "CoreRuntime|HostDispatcher|http.execute" | head -n 20)
echo "$LOGS"

# 6. Verify HTTP capability
echo "Verifying HTTP capability..."
if echo "$LOGS" | grep -q "http.execute"; then
  echo "✅ HTTP capability registered"
else
  echo "⚠️  No http.execute log (may not have triggered)"
fi

# 7. Capture screenshot
echo "Capturing screenshot..."
"$HDC" shell snapshot_display -f /tmp/host_smoke.png
"$HDC" file recv /tmp/host_smoke.png ./docs/evidence/host_smoke_device.png

# 8. Uninstall
echo "Uninstalling app..."
"$HDC" uninstall "$APP_PACKAGE"

echo "=== Device Smoke Complete ==="
echo "Evidence saved to: docs/evidence/host_smoke_device.png"
```

- [ ] **Step 2: 创建 host-device-proof.md 证据文档**

```markdown
# Host Device Proof — HarmonyOS

## 设备信息

- 平台：HarmonyOS
- 设备类型：Phone / Tablet / 2in1
- SDK 版本：6.0.2(22)
- 测试日期：YYYY-MM-DD

## Smoke 执行记录

### 1. HAP 构建与签名

```bash
hvigorw assembleHap --mode release -p product=default -p buildMode=release
# Output: entry/build/default/outputs/default/entry-default-signed.hap
```

### 2. 设备安装与启动

```bash
hdc install entry/build/default/outputs/default/entry-default-signed.hap
hdc shell aa start -a EntryAbility -b reader.minliny.testpackage
```

### 3. CoreRuntime 初始化日志

```
[CoreRuntime] initialized with dataDir=/data/app/el2/100/base/reader.minliny.testpackage/files
[HostDispatcher] started polling
[HostCapabilityRegistry] registered: http.execute, cookie.get, cookie.set, file.read, file.write, file.delete
```

### 4. HTTP capability 验证

- [ ] `http.execute` 已注册到 HostCapabilityRegistry
- [ ] `ping()` 成功返回 pong
- [ ] `coreInfo()` 返回 version 字段

### 5. 截图证据

- 截图路径：`docs/evidence/host_smoke_device.png`
- 展示应用启动状态，证明 CoreRuntime 与 HostDispatcher 已初始化

## 结论

- [ ] HAP 构建成功
- [ ] 真机安装成功
- [ ] CoreRuntime 初始化成功
- [ ] HostDispatcher 启动成功
- [ ] HTTP capability 注册成功
- [ ] 有真机截图证据

**状态：PASS / PARTIAL / FAIL**
```

- [ ] **Step 3: 运行真机 smoke（需要设备连接）**

```bash
chmod +x scripts/device_smoke.sh
./scripts/device_smoke.sh
```

Expected: 输出显示 CoreRuntime 初始化日志，截图保存成功

- [ ] **Step 4: Commit 证据**

```bash
git add scripts/device_smoke.sh docs/evidence/
git commit -m "feat: add device smoke script and host device proof template"
```

---

## Completion Checklist

- [ ] Phase 0: Reader-Core-Native 依赖配置完成，NAPI 库链接成功
- [ ] Phase 1: Host 基础类型定义完成（HostRequest/HostResult/HostError）
- [ ] Phase 2: HostCapabilityRegistry 和 HostDispatcher 实现完成
- [ ] Phase 3: CoreRuntime 单例创建并在 EntryAbility 初始化
- [ ] Phase 4: HttpHostAdapter 实现完成，使用 @ohos.net.http
- [ ] Phase 5: CookieHostAdapter 实现完成，作用域内存 jar
- [ ] Phase 6: WebViewHostAdapter 实现完成，使用 @ohos.web.webview
- [ ] Phase 7: FileHostAdapter 实现完成，使用 @ohos.file.fs
- [ ] Phase 8: Host smoke 单元测试通过
- [ ] Phase 9: 真机设备 smoke 执行成功，截图证据保存

---

**Plan complete and saved to `docs/superpowers/plans/2026-07-07-host-integration.md`.**

**Two execution options:**

1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**