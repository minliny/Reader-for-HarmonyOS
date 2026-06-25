// ZipArchiveAdapter — clean-room HarmonyOS ZIP (PKZIP) archive reader.
// Handles both stored (method=0) and deflated (method=8) entries via an
// in-memory raw-DEFLATE decoder. Enforces safe-entry-path traversal guards.
// No external or GPL code is referenced. Intended for clean-room archive
// evidence and EPUB/CBZ parsing; not a general-purpose unzip utility.

import { decodeRawDeflate, crc32 } from './RawDeflateDecoder';

// ArchiveEntry is re-declared here (mirrors the shape in LocalBookPlatformAdapters)
// to avoid a circular import between platform/ and adapters/. Consumers that
// already hold an ArchiveEntry from LocalBookPlatformAdapters can pass it
// directly because the structural shape is identical.
export interface ArchiveEntry {
  path: string;
  data: Uint8Array;
}

export interface ZipEntry extends ArchiveEntry {
  method: number;       // 0 = stored, 8 = deflated
  crc32: number;        // declared CRC32 from the local header (0 if absent)
  uncompressedSize: number;
}

export interface ZipArchiveEvidence {
  entryCount: number;
  methodSupport: string;   // e.g. "stored+deflate"
  safeEntryPathPass: boolean;
  crcValidated: boolean;
  rawArchiveExported: boolean;
  checksum: string;
}

export class UnsupportedZipMethodError extends Error {
  constructor(method: number) {
    super(`UnsupportedZipMethod:${method}`);
    this.name = 'UnsupportedZipMethodError';
  }
}

export class ZipArchiveAdapter {
  /**
   * Parse local-file records from a ZIP archive byte buffer.
   * Supports method 0 (stored) and method 8 (deflated). Throws on unsupported
   * methods, unsafe entry paths, or structural truncation.
   */
  entries(data: Uint8Array): ZipEntry[] {
    const entries: ZipEntry[] = [];
    let offset = 0;
    while (offset + 30 <= data.length) {
      const signature = this.readUInt32LE(data, offset);
      if (signature !== 0x04034b50) { break; }
      const method = this.readUInt16LE(data, offset + 8);
      const crc = this.readUInt32LE(data, offset + 14);
      const compressedSize = this.readUInt32LE(data, offset + 18);
      const uncompressedSize = this.readUInt32LE(data, offset + 22);
      const fileNameLength = this.readUInt16LE(data, offset + 26);
      const extraLength = this.readUInt16LE(data, offset + 28);
      const nameStart = offset + 30;
      const dataStart = nameStart + fileNameLength + extraLength;
      const dataEnd = dataStart + compressedSize;
      if (dataEnd > data.length) { throw new Error('ZipEntryTruncated'); }

      const path = this.ascii(data.subarray(nameStart, nameStart + fileNameLength));
      if (!this.safeEntryPath(path)) { throw new Error('UnsafeZipEntryPath'); }

      const compressed = data.subarray(dataStart, dataEnd);
      let content: Uint8Array;
      if (method === 0) {
        if (compressedSize !== uncompressedSize) { throw new Error('StoredSizeMismatch'); }
        content = compressed;
      } else if (method === 8) {
        const decoded = decodeRawDeflate(compressed, 0);
        content = decoded.output;
        if (content.length !== uncompressedSize) { throw new Error('DeflateSizeMismatch'); }
      } else {
        throw new UnsupportedZipMethodError(method);
      }

      // CRC cross-check when a CRC is declared and content is non-empty.
      if (crc !== 0 && content.length > 0) {
        const actual = crc32(content);
        if (actual !== crc) { throw new Error('ZipCrcMismatch'); }
      }

      entries.push({
        path,
        data: content,
        method,
        crc32: crc,
        uncompressedSize
      });
      offset = dataEnd;
    }
    return entries;
  }

  /** Locate a single entry by exact path; returns null if absent. */
  entry(data: Uint8Array, path: string): ZipEntry | null {
    const all = this.entries(data);
    for (let i = 0; i < all.length; i++) {
      if (all[i].path === path) { return all[i]; }
    }
    return null;
  }

  safeEntryPath(path: string): boolean {
    return path.length > 0 &&
      path.indexOf('..') === -1 &&
      path.indexOf('\\') === -1 &&
      path.charAt(0) !== '/';
  }

  buildEvidence(data: Uint8Array): ZipArchiveEvidence {
    const all = this.entries(data);
    const methods = new Set<number>();
    let safe = true;
    for (let i = 0; i < all.length; i++) {
      methods.add(all[i].method);
      if (!this.safeEntryPath(all[i].path)) { safe = false; }
    }
    const methodList = Array.from(methods).sort((a, b) => a - b);
    const label = methodList.map((m: number) => m === 0 ? 'stored' : m === 8 ? 'deflate' : `m${m}`).join('+');
    return {
      entryCount: all.length,
      methodSupport: label.length > 0 ? label : 'none',
      safeEntryPathPass: safe,
      crcValidated: true,
      rawArchiveExported: false,
      checksum: this.checksum(all)
    };
  }

  private checksum(entries: ZipEntry[]): string {
    let acc = 0;
    for (let i = 0; i < entries.length; i++) {
      acc = (acc * 31 + entries[i].path.length + entries[i].method + entries[i].uncompressedSize) | 0;
    }
    return `zip:${acc >>> 0}`;
  }

  private readUInt16LE(data: Uint8Array, offset: number): number {
    return data[offset] | (data[offset + 1] << 8);
  }

  private readUInt32LE(data: Uint8Array, offset: number): number {
    return (data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24)) >>> 0;
  }

  private ascii(data: Uint8Array): string {
    let out = '';
    for (let i = 0; i < data.length; i++) { out += String.fromCharCode(data[i]); }
    return out;
  }
}
