// FileHostAdapter — Host adapter for file.read / file.write / file.delete.
// Source of truth: Reader-Core-Native docs/host-app-contracts/01-network-session.md §3.6.
// Phase 7 implementation.
//
// Path resolution:
//   - 'files://<rel>' → context.filesDir + '/<rel>'
//   - 'cache://<rel>' → context.cacheDir + '/<rel>'
//   - everything else is treated as an absolute sandbox path.
//
// Read returns both the legacy UTF-8 text projection and the lossless
// contentBase64 projection, and honors the contract's byte window. Write
// decodes contentBase64 and preserves append/createDirectories semantics.
//
// Error mapping: file not found (ENOENT, 13900002) → FILE_NOT_FOUND,
// everything else → FILE_PERMISSION_DENIED.
import fs from '@ohos.file.fs';
import util from '@ohos.util';
import common from '@ohos.app.ability.common';
import {
  HostFileReadRequest,
  HostFileReadResponse,
  HostFileWriteRequest,
  HostFileWriteResponse,
  HostFileDeleteRequest,
  HostFileDeleteResponse,
  HostStoragePathResponse,
  HostError,
  HostErrorWrapper,
  createCapabilityUnavailableError,
  createFileNotFoundError,
} from '../types';

const FILES_PREFIX: string = 'files://';
const CACHE_PREFIX: string = 'cache://';
const ENOENT_CODE: number = 13900002;

interface FsErrorLike {
  code?: number;
  message?: string;
}

export class FileHostAdapter {
  private context: common.Context;
  private atomicPartFds: Map<string, number> = new Map<string, number>();

  constructor(context: common.Context) {
    this.context = context;
  }

  async read(event: HostFileReadRequest): Promise<HostFileReadResponse> {
    const resolvedPath = this.resolvePath(event.path);
    try {
      const stat = fs.statSync(resolvedPath);
      const file = fs.openSync(resolvedPath, fs.OpenMode.READ_ONLY);
      try {
        const size: number = stat.size;
        const offset = this.nonNegativeInteger(event.byteOffset, 0, 'byteOffset');
        const remaining = Math.max(0, size - offset);
        const requestedMax = this.nonNegativeInteger(event.maxBytes, remaining, 'maxBytes');
        const readLength = Math.min(remaining, requestedMax);
        let actualLength = 0;
        let content = '';
        let contentBase64 = '';
        if (readLength > 0) {
          fs.lseek(file.fd, offset, fs.WhenceType.SEEK_SET);
          const buffer = new ArrayBuffer(readLength);
          const bytesRead = fs.readSync(file.fd, buffer);
          actualLength = bytesRead;
          const bytes = new Uint8Array(buffer, 0, bytesRead);
          const decoder = util.TextDecoder.create('utf-8');
          content = decoder.decodeToString(bytes);
          contentBase64 = new util.Base64Helper().encodeToStringSync(bytes);
        }
        const response: HostFileReadResponse = {
          content: content,
          contentBase64: contentBase64,
          encoding: event.encoding ?? 'utf-8',
          byteLength: actualLength,
        };
        return response;
      } finally {
        fs.closeSync(file);
      }
    } catch (e) {
      throw new HostErrorWrapper(this.mapError(e, event.path));
    }
  }

  async write(event: HostFileWriteRequest): Promise<HostFileWriteResponse> {
    const resolvedPath = this.resolvePath(event.path);
    try {
      // Ensure parent directory exists — fs.openSync only creates the file,
      // not intermediate directories. This makes file.write robust for paths
      // like cache://rss/feed.xml where the 'rss' subdir doesn't exist yet.
      if (event.createDirectories === true) this.ensureParentDir(resolvedPath);
      const openMode = event.append === true
        ? fs.OpenMode.CREATE | fs.OpenMode.WRITE_ONLY | fs.OpenMode.APPEND
        : fs.OpenMode.CREATE | fs.OpenMode.WRITE_ONLY | fs.OpenMode.TRUNC;
      const file = fs.openSync(
        resolvedPath,
        openMode
      );
      try {
        let bytes = new Uint8Array(0);
        if (event.contentBase64 !== undefined) {
          bytes = new util.Base64Helper().decodeSync(event.contentBase64);
        } else {
          const content = event.content ?? '';
          bytes = util.TextEncoder.create(event.encoding ?? 'utf-8').encodeInto(content);
        }
        if (bytes.byteLength > 0) {
          const exact = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
          this.writeAll(file.fd, exact);
        }
        const response: HostFileWriteResponse = {
          written: true,
          byteLength: bytes.byteLength,
        };
        return response;
      } finally {
        fs.closeSync(file);
      }
    } catch (e) {
      throw new HostErrorWrapper(this.mapError(e, event.path));
    }
  }

  /**
   * Internal Host transaction used by media.download. Bytes are written to a
   * sibling `.part` file and become visible at the final path only after the
   * complete payload has been persisted.
   */
  async writeAtomic(event: HostFileWriteRequest): Promise<HostFileWriteResponse> {
    if (event.append === true) {
      throw new HostErrorWrapper(this.filePermissionError(
        event.path, 'atomic file writes cannot append',
      ));
    }
    let partOpened = false;
    try {
      this.openAtomicPart(event.path, event.createDirectories === true);
      partOpened = true;
      let bytes: Uint8Array;
      if (event.contentBase64 !== undefined) {
        bytes = new util.Base64Helper().decodeSync(event.contentBase64);
      } else {
        bytes = util.TextEncoder.create(event.encoding ?? 'utf-8').encodeInto(event.content ?? '');
      }
      if (bytes.byteLength > 0) {
        const exact = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        this.appendAtomicPart(event.path, exact);
      }
      this.commitAtomicPart(event.path);
      partOpened = false;
      return { written: true, byteLength: bytes.byteLength };
    } catch (e) {
      if (partOpened) this.discardAtomicPart(event.path);
      if (e instanceof Error) throw e;
      throw new Error(String(e));
    }
  }

  /** Streaming half of writeAtomic; used only by Host-owned binary download. */
  openAtomicPart(path: string, createDirectories: boolean = true): void {
    if (this.atomicPartFds.has(path)) {
      throw new HostErrorWrapper(this.filePermissionError(path, 'atomic part is already open'));
    }
    const finalPath = this.resolvePath(path);
    const partPath = `${finalPath}.part`;
    try {
      if (createDirectories) this.ensureParentDir(finalPath);
      try {
        fs.unlinkSync(partPath);
      } catch (_missingPart) {
        // No stale part is the normal case.
      }
      const file = fs.openSync(
        partPath,
        fs.OpenMode.CREATE | fs.OpenMode.WRITE_ONLY | fs.OpenMode.TRUNC,
      );
      this.atomicPartFds.set(path, file.fd);
    } catch (e) {
      throw new HostErrorWrapper(this.mapError(e, path));
    }
  }

  appendAtomicPart(path: string, chunk: ArrayBuffer): void {
    const fd = this.atomicPartFds.get(path);
    if (fd === undefined) {
      throw new HostErrorWrapper(this.filePermissionError(path, 'atomic part is not open'));
    }
    try {
      this.writeAll(fd, chunk);
    } catch (e) {
      throw new HostErrorWrapper(this.mapError(e, path));
    }
  }

  commitAtomicPart(path: string): void {
    const fd = this.atomicPartFds.get(path);
    if (fd === undefined) {
      throw new HostErrorWrapper(this.filePermissionError(path, 'atomic part is not open'));
    }
    this.atomicPartFds.delete(path);
    const finalPath = this.resolvePath(path);
    const partPath = `${finalPath}.part`;
    let closed = false;
    try {
      fs.fsyncSync(fd);
      fs.closeSync(fd);
      closed = true;
      fs.renameSync(partPath, finalPath);
    } catch (e) {
      if (!closed) {
        try {
          fs.closeSync(fd);
        } catch (_closeError) {
          // Preserve the commit error.
        }
      }
      try {
        fs.unlinkSync(partPath);
      } catch (_cleanupError) {
        // Preserve the commit error.
      }
      throw new HostErrorWrapper(this.mapError(e, path));
    }
  }

  discardAtomicPart(path: string): void {
    const fd = this.atomicPartFds.get(path);
    if (fd !== undefined) {
      this.atomicPartFds.delete(path);
      try {
        fs.closeSync(fd);
      } catch (_closeError) {
        // Cleanup remains best-effort.
      }
    }
    try {
      fs.unlinkSync(`${this.resolvePath(path)}.part`);
    } catch (_cleanupError) {
      // A missing part is already discarded.
    }
  }

  async delete(event: HostFileDeleteRequest): Promise<HostFileDeleteResponse> {
    const resolvedPath = this.resolvePath(event.path);
    try {
      fs.unlinkSync(resolvedPath);
      return { deleted: true };
    } catch (e) {
      throw new HostErrorWrapper(this.mapError(e, event.path));
    }
  }

  /**
   * storage.path — return the platform storage directory for a given scope.
   * scope "files" → app filesDir; scope "cache" → app cacheDir.
   *
   * HarmonyOS Context intentionally exposes sandbox directories, not a raw
   * shared/external filesystem root. External access must go through a picker
   * URI, so that scope fails closed instead of silently returning filesDir.
   */
  storagePath(scope: 'cache' | 'files' | 'external' = 'files'): HostStoragePathResponse {
    let path: string;
    switch (scope) {
      case 'cache':
        path = this.context.cacheDir;
        break;
      case 'files':
        path = this.context.filesDir;
        break;
      case 'external':
        throw new HostErrorWrapper(createCapabilityUnavailableError('storage.path:external'));
    }
    const result: HostStoragePathResponse = { path: path };
    return result;
  }

  // ── internal ──

  private resolvePath(path: string): string {
    if (path.startsWith(FILES_PREFIX)) {
      return this.resolveSandboxRelative(this.context.filesDir, path.substring(FILES_PREFIX.length), path);
    }
    if (path.startsWith(CACHE_PREFIX)) {
      return this.resolveSandboxRelative(this.context.cacheDir, path.substring(CACHE_PREFIX.length), path);
    }
    return path;
  }

  private resolveSandboxRelative(root: string, relative: string, originalPath: string): string {
    const parts = relative.split('/');
    for (let index = 0; index < parts.length; index++) {
      if (parts[index] === '..') {
        throw new HostErrorWrapper(this.filePermissionError(
          originalPath, 'sandbox path traversal is not allowed',
        ));
      }
    }
    return root + '/' + relative;
  }

  private ensureParentDir(filePath: string): void {
    const lastSlash = filePath.lastIndexOf('/');
    if (lastSlash <= 0) {
      return; // no parent dir to create
    }
    const parentDir = filePath.substring(0, lastSlash);
    try {
      fs.mkdirSync(parentDir, true);
    } catch (e) {
      // dir may already exist — ignore; the subsequent openSync will surface
      // real permission/path errors.
    }
  }

  private writeAll(fd: number, buffer: ArrayBuffer): void {
    let written = 0;
    while (written < buffer.byteLength) {
      const remaining = buffer.slice(written);
      const count = fs.writeSync(fd, remaining);
      if (count <= 0) throw new Error('file write made no progress');
      written += count;
    }
  }

  private nonNegativeInteger(value: number | undefined, fallback: number, field: string): number {
    if (value === undefined) return fallback;
    if (!Number.isFinite(value) || value < 0 || Math.floor(value) !== value) {
      throw new Error(`${field} must be a non-negative integer`);
    }
    return value;
  }

  private mapError(e: Object, originalPath: string): HostError {
    const err = e as FsErrorLike;
    const code = err.code ?? 0;
    const message = err.message ?? 'file operation failed';
    if (this.isNotFound(code, message)) {
      return createFileNotFoundError(originalPath);
    }
    return this.filePermissionError(originalPath, message);
  }

  private filePermissionError(path: string, message: string): HostError {
    return {
      code: 'FILE_PERMISSION_DENIED',
      message: message,
      retryable: false,
      details: { phase: 'Storage', path: path },
    };
  }

  private isNotFound(code: number, message: string): boolean {
    if (code === ENOENT_CODE) {
      return true;
    }
    const msg = message.toLowerCase();
    return msg.includes('no such file') ||
      msg.includes('does not exist') ||
      msg.includes('not exist');
  }
}
