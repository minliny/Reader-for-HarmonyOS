// FileHostAdapter — Host adapter for file.read / file.write / file.delete.
// Source of truth: Reader-Core-Native docs/host-app-contracts/01-network-session.md §3.6.
// Phase 7 implementation.
//
// Path resolution:
//   - 'files://<rel>' → context.filesDir + '/<rel>'
//   - 'cache://<rel>' → context.cacheDir + '/<rel>'
//   - everything else is treated as an absolute sandbox path.
//
// Read uses fs.statSync (for size) + fs.openSync(READ_ONLY) + fs.readSync +
// fs.closeSync; the byte buffer is decoded as UTF-8 text and returned in
// HostFileReadResponse.content (string). Binary payloads should ideally use
// contentBase64, but the contract here keeps content as string for ArkTS
// compatibility (no Uint8Array union).
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
  HostError,
  HostErrorWrapper,
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
        let content = '';
        if (size > 0) {
          const buffer = new ArrayBuffer(size);
          fs.readSync(file.fd, buffer);
          const decoder = util.TextDecoder.create('utf-8');
          content = decoder.decodeWithStream(new Uint8Array(buffer));
        }
        const response: HostFileReadResponse = {
          content: content,
          encoding: event.encoding ?? 'utf-8',
          byteLength: size,
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
      this.ensureParentDir(resolvedPath);
      const file = fs.openSync(
        resolvedPath,
        fs.OpenMode.CREATE | fs.OpenMode.WRITE_ONLY | fs.OpenMode.TRUNC
      );
      try {
        const content = event.content ?? event.contentBase64 ?? '';
        let bytesWritten = 0;
        if (content.length > 0) {
          bytesWritten = fs.writeSync(file.fd, content);
        }
        const response: HostFileWriteResponse = {
          written: true,
          byteLength: bytesWritten,
        };
        return response;
      } finally {
        fs.closeSync(file);
      }
    } catch (e) {
      throw new HostErrorWrapper(this.mapError(e, event.path));
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

  // ── internal ──

  private resolvePath(path: string): string {
    if (path.startsWith(FILES_PREFIX)) {
      return this.context.filesDir + '/' + path.substring(FILES_PREFIX.length);
    }
    if (path.startsWith(CACHE_PREFIX)) {
      return this.context.cacheDir + '/' + path.substring(CACHE_PREFIX.length);
    }
    return path;
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

  private mapError(e: Object, originalPath: string): HostError {
    const err = e as FsErrorLike;
    const code = err.code ?? 0;
    const message = err.message ?? 'file operation failed';
    if (this.isNotFound(code, message)) {
      return createFileNotFoundError(originalPath);
    }
    const permError: HostError = {
      code: 'FILE_PERMISSION_DENIED',
      message: message,
      retryable: false,
      details: { phase: 'Storage', path: originalPath },
    };
    return permError;
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
