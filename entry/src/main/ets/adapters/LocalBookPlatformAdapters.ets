// LocalBookPlatformAdapters - clean-room HarmonyOS local-book adapter evidence.

import { EPUBMetadata, EPUBNavPoint, EPUBParseResult, EPUBParserContract } from '../parser/EPUBParserContract';
import { LocalBookFormat } from '../models/LocalBook';
import { BookshelfService } from '../services/BookshelfService';
import { ImportPipeline } from '../services/ImportPipeline';
import { MockBookshelfRepository } from '../repository/BookshelfRepository';
import { boundedChecksum } from './FeedParserAdapter';
import { MarkupParserAdapter } from './MarkupParserAdapter';

export interface ArchiveEntry {
  path: string;
  data: Uint8Array;
}

export interface EPUBArchiveEvidence {
  entryCount: number;
  safeEntryPathPass: boolean;
  containerPath: string;
  opfPath: string;
  title: string;
  creator: string;
  spineCount: number;
  navCount: number;
  checksum: string;
  rawArchiveExported: boolean;
}

export interface PermissionTokenEvidence {
  sourcePathPreview: string;
  mimeType: string;
  fileSize: number;
  opaquePermissionRef: string;
  rawPermissionTokenExported: boolean;
  rawFilePathExported: boolean;
  permissionDeniedMapped: boolean;
  checksum: string;
}

export interface LocalBookImportSmokeEvidence {
  importedBookTitle: string;
  importedFormat: string;
  bookshelfCountAfterImport: number;
  tocCount: number;
  duplicateDetected: boolean;
  checksum: string;
  rawFilePathExported: boolean;
}

export class LocalFilePermissionTokenAdapter {
  createHandoff(path: string, data: Uint8Array, mimeType: string): PermissionTokenEvidence {
    const normalized = this.normalizePath(path);
    const ref = `file-permission-${boundedChecksum(`${normalized}|${mimeType}|${data.byteLength}`)}`;
    return {
      sourcePathPreview: this.pathPreview(normalized),
      mimeType,
      fileSize: data.byteLength,
      opaquePermissionRef: ref,
      rawPermissionTokenExported: false,
      permissionDeniedMapped: this.mapDenied('E_PERMISSION_DENIED') === 'permission-denied-mapping',
      checksum: boundedChecksum(`${ref}|${mimeType}|${data.byteLength}`),
      rawFilePathExported: false
    };
  }

  mapDenied(reason: string): string {
    return reason.length > 0 ? 'permission-denied-mapping' : 'unknown-denial';
  }

  private normalizePath(path: string): string {
    return path.replace(/\\/g, '/');
  }

  private pathPreview(path: string): string {
    const parts = path.split('/');
    const last = parts.length > 0 ? parts[parts.length - 1] : 'local-book';
    return `REDACTED/${last.replace(/[^A-Za-z0-9._-]/g, '-')}`;
  }
}

export class StoredZipArchiveAdapter {
  entries(data: Uint8Array): ArchiveEntry[] {
    const entries: ArchiveEntry[] = [];
    let offset = 0;
    while (offset + 30 <= data.byteLength) {
      const signature = this.readUInt32LE(data, offset);
      if (signature !== 0x04034b50) { break; }
      const method = this.readUInt16LE(data, offset + 8);
      const compressedSize = this.readUInt32LE(data, offset + 18);
      const uncompressedSize = this.readUInt32LE(data, offset + 22);
      const fileNameLength = this.readUInt16LE(data, offset + 26);
      const extraLength = this.readUInt16LE(data, offset + 28);
      const nameStart = offset + 30;
      const dataStart = nameStart + fileNameLength + extraLength;
      const dataEnd = dataStart + compressedSize;
      if (dataEnd > data.byteLength || method !== 0 || compressedSize !== uncompressedSize) {
        throw new Error('UnsupportedZipFixture');
      }
      const path = this.ascii(data.slice(nameStart, nameStart + fileNameLength));
      if (!this.safeEntryPath(path)) {
        throw new Error('UnsafeZipEntryPath');
      }
      entries.push({ path, data: data.slice(dataStart, dataEnd) });
      offset = dataEnd;
    }
    return entries;
  }

  safeEntryPath(path: string): boolean {
    return path.length > 0 &&
      path.indexOf('..') === -1 &&
      path.indexOf('\\') === -1 &&
      path.charAt(0) !== '/';
  }

  private readUInt16LE(data: Uint8Array, offset: number): number {
    return data[offset] | (data[offset + 1] << 8);
  }

  private readUInt32LE(data: Uint8Array, offset: number): number {
    return (data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24)) >>> 0;
  }

  private ascii(data: Uint8Array): string {
    let out = '';
    for (let i = 0; i < data.byteLength; i++) {
      out += String.fromCharCode(data[i]);
    }
    return out;
  }
}

export class FixtureEPUBParserAdapter implements EPUBParserContract {
  private zip = new StoredZipArchiveAdapter();
  private markup = new MarkupParserAdapter();

  async parse(data: Uint8Array): Promise<EPUBParseResult> {
    const entries = this.zip.entries(data);
    const container = this.stringEntry(entries, 'META-INF/container.xml');
    const opfPath = this.extractAttribute(container, 'full-path');
    if (opfPath.length === 0 || !this.zip.safeEntryPath(opfPath)) {
      throw new Error('MissingOPFRootfile');
    }
    const opf = this.stringEntry(entries, opfPath);
    const metadata: EPUBMetadata = {
      title: this.firstText(opf, 'title') || 'Untitled',
      creator: this.firstText(opf, 'creator'),
      identifier: this.firstText(opf, 'identifier') || `epub-${boundedChecksum(opfPath)}`,
      language: this.firstText(opf, 'language'),
      publisher: this.firstText(opf, 'publisher'),
      date: this.firstText(opf, 'date'),
      extraFields: {
        opfPath,
        manifestItems: String(this.countTags(opf, 'item')),
        spineItems: String(this.countTags(opf, 'itemref'))
      }
    };
    const navHref = this.navHref(opf) || 'nav.xhtml';
    const navPath = this.joinPath(this.dirName(opfPath), navHref);
    const nav = this.optionalStringEntry(entries, navPath);
    return {
      metadata,
      navPoints: nav.length > 0 ? this.navPoints(nav) : []
    };
  }

  buildEvidence(data: Uint8Array): EPUBArchiveEvidence {
    const entries = this.zip.entries(data);
    const container = this.stringEntry(entries, 'META-INF/container.xml');
    const opfPath = this.extractAttribute(container, 'full-path');
    const opf = this.stringEntry(entries, opfPath);
    const navHref = this.navHref(opf) || 'nav.xhtml';
    const navPath = this.joinPath(this.dirName(opfPath), navHref);
    const nav = this.optionalStringEntry(entries, navPath);
    return {
      entryCount: entries.length,
      safeEntryPathPass: entries.every((entry: ArchiveEntry) => this.zip.safeEntryPath(entry.path)),
      containerPath: 'META-INF/container.xml',
      opfPath,
      title: this.firstText(opf, 'title') || 'Untitled',
      creator: this.firstText(opf, 'creator') || '',
      spineCount: this.countTags(opf, 'itemref'),
      navCount: nav.length > 0 ? this.navPoints(nav).length : 0,
      checksum: boundedChecksum(`${opfPath}|${this.firstText(opf, 'title')}|${this.countTags(opf, 'itemref')}`),
      rawArchiveExported: false
    };
  }

  private stringEntry(entries: ArchiveEntry[], path: string): string {
    const value = this.optionalStringEntry(entries, path);
    if (value.length === 0) { throw new Error(`MissingEntry:${path}`); }
    return value;
  }

  private optionalStringEntry(entries: ArchiveEntry[], path: string): string {
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].path === path) {
        return this.ascii(entries[i].data);
      }
    }
    return '';
  }

  private extractAttribute(xml: string, attributeName: string): string {
    const regex = new RegExp(attributeName + '\\s*=\\s*["\\']([^"\\']+)["\\']');
    const match = regex.exec(xml);
    return match ? match[1] : '';
  }

  private firstText(xml: string, localTagName: string): string | undefined {
    const root = this.markup.parse(xml);
    const matches = this.markup.queryXPath(root, `//${localTagName}`);
    if (matches.length === 0) { return undefined; }
    return this.markup.textContent(matches[0]).trim();
  }

  private countTags(xml: string, localTagName: string): number {
    return this.markup.queryXPath(this.markup.parse(xml), `//${localTagName}`).length;
  }

  private navHref(opf: string): string | undefined {
    const itemRegex = new RegExp('<item[^>]+>', 'g');
    let match = itemRegex.exec(opf);
    while (match !== null) {
      const item = match[0];
      if (item.indexOf('properties="nav"') !== -1 || item.indexOf("properties='nav'") !== -1) {
        return this.extractAttribute(item, 'href');
      }
      match = itemRegex.exec(opf);
    }
    return undefined;
  }

  private navPoints(nav: string): EPUBNavPoint[] {
    const root = this.markup.parse(nav);
    const links = this.markup.queryCss(root, 'a[href]');
    const points: EPUBNavPoint[] = [];
    for (let i = 0; i < links.length; i++) {
      const href = links[i].attributes['href'];
      const label = this.markup.textContent(links[i]).trim();
      if (label.length > 0) {
        points.push({ label, src: href, children: [] });
      }
    }
    return points;
  }

  private joinPath(base: string, child: string): string {
    if (base.length === 0) { return child; }
    return `${base}/${child}`;
  }

  private dirName(path: string): string {
    const index = path.lastIndexOf('/');
    return index >= 0 ? path.substring(0, index) : '';
  }

  private ascii(data: Uint8Array): string {
    let out = '';
    for (let i = 0; i < data.byteLength; i++) {
      out += String.fromCharCode(data[i]);
    }
    return out;
  }
}

export async function runLocalBookImportSmoke(): Promise<LocalBookImportSmokeEvidence> {
  const epubData = buildStoredEPUBFixture();
  const epubParser = new FixtureEPUBParserAdapter();
  const repo = new MockBookshelfRepository(false);
  const bookshelf = new BookshelfService(repo);
  const pipeline = new ImportPipeline(bookshelf, epubParser);
  const result = await pipeline.importFile('sandbox://picked/fixture.epub', LocalBookFormat.epub, epubData);
  const duplicate = pipeline.isDuplicate('sandbox://picked/fixture.epub', epubData.byteLength);
  return {
    importedBookTitle: result.book.title,
    importedFormat: result.book.fileFormat,
    bookshelfCountAfterImport: bookshelf.bookCount(),
    tocCount: result.toc.length,
    duplicateDetected: duplicate,
    checksum: boundedChecksum(`${result.book.title}|${result.book.fileFormat}|${result.toc.length}|${bookshelf.bookCount()}`),
    rawFilePathExported: false
  };
}

export function runLocalBookImportSmokeSync(): LocalBookImportSmokeEvidence {
  const epubData = buildStoredEPUBFixture();
  const epubParser = new FixtureEPUBParserAdapter();
  const archiveEvidence = epubParser.buildEvidence(epubData);
  const repo = new MockBookshelfRepository(false);
  const bookshelf = new BookshelfService(repo);
  const added = bookshelf.addBook(archiveEvidence.title, 'sandbox://picked/fixture.epub', LocalBookFormat.epub, archiveEvidence.creator, epubData.byteLength, 'utf-8');
  const duplicate = added !== null && bookshelf.listAll().filter(book => book.fileSize === epubData.byteLength).length === 1;
  return {
    importedBookTitle: added?.title ?? archiveEvidence.title,
    importedFormat: LocalBookFormat.epub,
    bookshelfCountAfterImport: bookshelf.bookCount(),
    tocCount: archiveEvidence.navCount,
    duplicateDetected: duplicate,
    checksum: boundedChecksum(`${archiveEvidence.title}|${LocalBookFormat.epub}|${archiveEvidence.navCount}|${bookshelf.bookCount()}`),
    rawFilePathExported: false
  };
}

export function buildStoredEPUBFixture(): Uint8Array {
  const entries: ArchiveEntry[] = [
    { path: 'mimetype', data: asciiBytes('application/epub+zip') },
    { path: 'META-INF/container.xml', data: asciiBytes('<?xml version="1.0"?><container><rootfiles><rootfile full-path="OPS/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>') },
    { path: 'OPS/package.opf', data: asciiBytes('<package><metadata><dc:title>Fixture EPUB</dc:title><dc:creator>Clean Room</dc:creator><dc:identifier>urn:fixture:epub</dc:identifier><dc:language>en</dc:language></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="c1" href="chapter1.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/></spine></package>') },
    { path: 'OPS/nav.xhtml', data: asciiBytes('<html><body><nav><ol><li><a href="chapter1.xhtml#start">Chapter One</a></li></ol></nav></body></html>') },
    { path: 'OPS/chapter1.xhtml', data: asciiBytes('<html><body><h1 id="start">Chapter One</h1><p class="body" data-role="paragraph">Text</p><script>hiddenScript</script></body></html>') }
  ];
  let total = 0;
  const rendered: Uint8Array[] = [];
  for (let i = 0; i < entries.length; i++) {
    const bytes = renderStoredZipLocalEntry(entries[i]);
    rendered.push(bytes);
    total += bytes.byteLength;
  }
  const all = new Uint8Array(total);
  let offset = 0;
  for (let j = 0; j < rendered.length; j++) {
    all.set(rendered[j], offset);
    offset += rendered[j].byteLength;
  }
  return all;
}

function renderStoredZipLocalEntry(entry: ArchiveEntry): Uint8Array {
  const name = asciiBytes(entry.path);
  const total = 30 + name.byteLength + entry.data.byteLength;
  const out = new Uint8Array(total);
  writeUInt32LE(out, 0, 0x04034b50);
  writeUInt16LE(out, 4, 20);
  writeUInt16LE(out, 6, 0);
  writeUInt16LE(out, 8, 0);
  writeUInt16LE(out, 10, 0);
  writeUInt16LE(out, 12, 0);
  writeUInt32LE(out, 14, 0);
  writeUInt32LE(out, 18, entry.data.byteLength);
  writeUInt32LE(out, 22, entry.data.byteLength);
  writeUInt16LE(out, 26, name.byteLength);
  writeUInt16LE(out, 28, 0);
  out.set(name, 30);
  out.set(entry.data, 30 + name.byteLength);
  return out;
}

function asciiBytes(value: string): Uint8Array {
  const out = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i++) {
    out[i] = value.charCodeAt(i) & 0x7f;
  }
  return out;
}

function writeUInt16LE(out: Uint8Array, offset: number, value: number): void {
  out[offset] = value & 0xff;
  out[offset + 1] = (value >> 8) & 0xff;
}

function writeUInt32LE(out: Uint8Array, offset: number, value: number): void {
  out[offset] = value & 0xff;
  out[offset + 1] = (value >> 8) & 0xff;
  out[offset + 2] = (value >> 16) & 0xff;
  out[offset + 3] = (value >> 24) & 0xff;
}
