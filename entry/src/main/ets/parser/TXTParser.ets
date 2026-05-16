// TXTParser — LOCAL_FALLBACK_EXPERIMENTAL
// STATUS: BRIDGE_BLOCKED — awaiting HOS-2B-002 Swift bridge validation.
// This is an ArkTS re-implementation following Core TXTParser.swift logic.
// NOT production-ready until cross-validated against Core TXTParser output.
// Core TXTParser.swift is the authoritative implementation.
// Demote to LOCAL_FALLBACK if bridge is never built.
import { util } from '@kit.ArkTS';
import { LocalTOCItem, ChapterSplitPolicy, SplitPattern } from '../models/LocalBook';

export interface TXTParseResult {
  encoding: string;
  content: string;
  toc: LocalTOCItem[];
  byteCount: number;
}

export class TXTParser {
  private supportedEncodings: string[] = ['utf-8', 'utf8', 'gbk', 'gb2312', 'gb18030', 'latin-1', 'iso-8859-1', 'ascii'];

  parse(data: Uint8Array, encoding?: string, policy?: ChapterSplitPolicy): TXTParseResult {
    if (!data || data.byteLength === 0) {
      return { encoding: 'utf-8', content: '', toc: [], byteCount: 0 };
    }

    const resolvedEncoding = this.resolveEncoding(data, encoding);
    const content = this.decodeContent(data, resolvedEncoding);
    const toc = this.splitChapters(content, policy ?? { pattern: SplitPattern.auto });
    return { encoding: resolvedEncoding, content, toc, byteCount: data.byteLength };
  }

  // Encoding detection from BOM
  private resolveEncoding(data: Uint8Array, hint?: string): string {
    if (hint) {
      const lower = hint.toLowerCase();
      if (this.supportedEncodings.indexOf(lower) !== -1) {
        return lower;
      }
      return 'utf-8';
    }
    // BOM detection
    if (data.byteLength >= 3 && data[0] === 0xEF && data[1] === 0xBB && data[2] === 0xBF) {
      return 'utf-8';
    }
    if (data.byteLength >= 2 && data[0] === 0xFF && data[1] === 0xFE) {
      return 'utf-16le';
    }
    if (data.byteLength >= 2 && data[0] === 0xFE && data[1] === 0xFF) {
      return 'utf-16be';
    }
    return 'utf-8';
  }

  // Decode Uint8Array to string using detected encoding
  private decodeContent(data: Uint8Array, encoding: string): string {
    try {
      const textDecoder = util.TextDecoder.create(encoding, { ignoreBOM: true });
      return textDecoder.decodeToString(data, { stream: false });
    } catch (_e) {
      // Fallback to utf-8
      try {
        const fallbackDecoder = util.TextDecoder.create('utf-8', { ignoreBOM: true });
        return fallbackDecoder.decodeToString(data, { stream: false });
      } catch (_e2) {
        return '';
      }
    }
  }

  // Chapter splitting
  private splitChapters(content: string, policy: ChapterSplitPolicy): LocalTOCItem[] {
    const single: LocalTOCItem[] = [{ title: 'Chapter 1', level: 1, byteOffset: 0 }];

    switch (policy.pattern) {
      case SplitPattern.regex:
        if (!policy.regex || policy.regex.length === 0) { return single; }
        return this.splitByRegex(content, policy.regex);
      case SplitPattern.marker:
        if (!policy.marker || policy.marker.length === 0) { return single; }
        return this.splitByMarker(content, policy.marker);
      case SplitPattern.size:
        if (!policy.sizeBytes || policy.sizeBytes <= 0) { return single; }
        return this.splitBySize(content, policy.sizeBytes);
      case SplitPattern.auto:
        return this.autoSplit(content);
      default:
        return single;
    }
  }

  // Regex-based chapter splitting
  private splitByRegex(content: string, pattern: string): LocalTOCItem[] {
    const lines = content.split('\n');
    const chapters: LocalTOCItem[] = [];
    let currentByteOffset = 0;

    try {
      const regex = new RegExp(pattern);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineBytes = this.stringByteLength(line) + 1; // +1 for \n
        if (regex.test(line)) {
          chapters.push({ title: line.trim(), level: 1, byteOffset: currentByteOffset });
        }
        currentByteOffset += lineBytes;
      }
    } catch (_e) {
      // Invalid regex, return single chapter
      return [{ title: 'Chapter 1', level: 1, byteOffset: 0 }];
    }

    return chapters.length === 0 ? [{ title: 'Chapter 1', level: 1, byteOffset: 0 }] : chapters;
  }

  // Marker-based chapter splitting
  private splitByMarker(content: string, marker: string): LocalTOCItem[] {
    const parts = content.split(marker);
    if (parts.length <= 1) {
      return [{ title: 'Chapter 1', level: 1, byteOffset: 0 }];
    }

    const chapters: LocalTOCItem[] = [];
    let offset = 0;
    const markerLen = this.stringByteLength(marker);

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const partLen = this.stringByteLength(part);

      if (i === 0 && part.trim().length === 0) {
        offset += partLen + markerLen;
        continue;
      }

      const firstLine = part.split('\n')[0];
      const title = firstLine.trim().length > 0 ? firstLine.trim() : `Chapter ${i + 1}`;
      chapters.push({ title, level: 1, byteOffset: offset });
      offset += partLen + markerLen;
    }

    return chapters.length === 0 ? [{ title: 'Chapter 1', level: 1, byteOffset: 0 }] : chapters;
  }

  // Size-based splitting
  private splitBySize(content: string, sizeBytes: number): LocalTOCItem[] {
    const totalSize = this.stringByteLength(content);
    if (totalSize <= 0) {
      return [{ title: 'Chapter 1', level: 1, byteOffset: 0 }];
    }

    const chunkCount = Math.max(1, Math.ceil(totalSize / sizeBytes));
    const chapters: LocalTOCItem[] = [];

    for (let i = 0; i < chunkCount; i++) {
      chapters.push({ title: `Chapter ${i + 1}`, level: 1, byteOffset: i * sizeBytes });
    }
    return chapters;
  }

  // Auto-detect chapter patterns
  private autoSplit(content: string): LocalTOCItem[] {
    const patterns = [
      '^第[0-9零一二三四五六七八九十百千]+[章节回卷]',
      '^Chapter\\s+[0-9]+',
      '^#{1,3}\\s'
    ];

    for (let i = 0; i < patterns.length; i++) {
      const result = this.splitByRegex(content, patterns[i]);
      if (result.length > 1) {
        return result;
      }
    }
    return [{ title: 'Chapter 1', level: 1, byteOffset: 0 }];
  }

  // Estimate byte length of a UTF-8 string
  private stringByteLength(str: string): number {
    let len = 0;
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      if (code <= 0x7F) { len += 1; }
      else if (code <= 0x7FF) { len += 2; }
      else if (code <= 0xFFFF) { len += 3; }
      else { len += 4; }
    }
    return len;
  }
}
