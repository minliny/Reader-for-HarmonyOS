import common from '@ohos.app.ability.common';
import fileIo from '@ohos.file.fs';
import util from '@ohos.util';
import { readLocalEpubEntryAsync } from '@reader/core-harmony';
import { ReadingBodyImageHost, type ReadingBodyImagePayload } from './ReadingBodyImageHost';

const LOCAL_EPUB_SCHEME = 'reader-local-epub://';
const LOCAL_MOBI_SCHEME = 'reader-local-mobi://';
const MAX_READING_IMAGE_BYTES = 16 * 1024 * 1024;
const MAX_LOCAL_IMAGE_BOOK_ID_BASE64_CHARS = 96; // Base64("local:" + 64 hex digits).
// A 2048 UTF-16-unit path occupies at most 6144 UTF-8 bytes.
const MAX_LOCAL_IMAGE_PATH_BASE64_CHARS = 8192;
const MAX_LOCAL_IMAGE_LOCATOR_CHARS = Math.max(LOCAL_EPUB_SCHEME.length, LOCAL_MOBI_SCHEME.length) +
  MAX_LOCAL_IMAGE_BOOK_ID_BASE64_CHARS + 1 + MAX_LOCAL_IMAGE_PATH_BASE64_CHARS;

type LocalEpubResourceLocator = {
  hash: string;
  archivePath: string;
};

/**
 * Host-owned byte access for a Core-normalized local EPUB locator.
 *
 * Core owns archive-relative path semantics. This adapter retains no reading
 * model and creates no second image cache: it keeps the original archive in
 * filesDir, asks Rust Core to read only the bounded ZIP entry, then delegates
 * validation/dimensions/render preparation to ReadingBodyImageHost.
 */
export class LocalEpubResourceHost {
  private readonly context: common.UIAbilityContext;

  constructor(context: common.UIAbilityContext) {
    this.context = context;
  }

  async load(
    locatorValue: string,
    isCurrent?: () => boolean,
  ): Promise<ReadingBodyImagePayload> {
    this.assertCurrent(isCurrent);
    const locator = this.parseLocator(locatorValue);
    return ReadingBodyImageHost.instance.loadResource(locatorValue,
      (current: () => boolean): Promise<Uint8Array> => this.readResource(locator, current), isCurrent);
  }

  private async readResource(locator: LocalEpubResourceLocator, isCurrent: () => boolean): Promise<Uint8Array> {
    this.assertCurrent(isCurrent);
    let archivePath = `${this.context.filesDir}/reader-import/books/${locator.hash}.source`;
    if (!(await fileIo.access(archivePath))) {
      archivePath = `${this.context.filesDir}/reader-import/books/${locator.hash}.epub`;
    }
    if (!(await fileIo.access(archivePath))) {
      throw new Error('local EPUB source asset is unavailable; re-import is required');
    }
    this.assertCurrent(isCurrent);
    const bytes = await readLocalEpubEntryAsync(
      archivePath,
      locator.archivePath,
      MAX_READING_IMAGE_BYTES,
    );
    this.assertCurrent(isCurrent);
    return bytes;
  }

  private assertCurrent(isCurrent?: () => boolean): void {
    if (isCurrent !== undefined && !isCurrent()) {
      throw new Error('reading body image request was cancelled');
    }
  }

  private parseLocator(value: string): LocalEpubResourceLocator {
    if (value.length > MAX_LOCAL_IMAGE_LOCATOR_CHARS) {
      throw new Error('local EPUB image locator exceeds its path limit');
    }
    const scheme = value.startsWith(LOCAL_MOBI_SCHEME) ? LOCAL_MOBI_SCHEME : LOCAL_EPUB_SCHEME;
    if (!value.startsWith(scheme)) {
      throw new Error('local EPUB image locator uses an unsupported scheme');
    }
    const tokens = value.substring(scheme.length).split('/');
    if (tokens.length !== 2 || tokens[0].length === 0 || tokens[1].length === 0 ||
      tokens[0].length > MAX_LOCAL_IMAGE_BOOK_ID_BASE64_CHARS ||
      tokens[1].length > MAX_LOCAL_IMAGE_PATH_BASE64_CHARS) {
      throw new Error('local EPUB image locator is malformed');
    }
    const decoder = util.TextDecoder.create('utf-8', { fatal: true, ignoreBOM: true });
    const bookId = decoder.decodeToString(
      new util.Base64Helper().decodeSync(tokens[0], util.Type.BASIC_URL_SAFE),
    );
    const archivePath = decoder.decodeToString(
      new util.Base64Helper().decodeSync(tokens[1], util.Type.BASIC_URL_SAFE),
    );
    const identity = /^local:([0-9a-f]{64})$/.exec(bookId);
    if (identity === null) {
      throw new Error('local EPUB image locator has an invalid book identity');
    }
    this.assertSafeArchivePath(archivePath);
    return { hash: identity[1], archivePath };
  }

  private assertSafeArchivePath(path: string): void {
    if (path.length === 0 || path.length > 2048 || path.startsWith('/') || path.indexOf('\\') >= 0 ||
      path.indexOf('\0') >= 0) {
      throw new Error('local EPUB image locator has an unsafe archive path');
    }
    const segments = path.split('/');
    for (const segment of segments) {
      if (segment.length === 0 || segment === '.' || segment === '..') {
        throw new Error('local EPUB image locator escapes its archive root');
      }
    }
  }

}
