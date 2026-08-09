import common from '@ohos.app.ability.common';
import fileIo from '@ohos.file.fs';
import util from '@ohos.util';
import { readLocalEpubEntry } from '@reader/core-harmony';
import { ReadingBodyImageHost, type ReadingBodyImagePayload } from './ReadingBodyImageHost';

const LOCAL_EPUB_SCHEME = 'reader-local-epub://';
const MAX_READING_IMAGE_BYTES = 16 * 1024 * 1024;

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

  async load(locatorValue: string): Promise<ReadingBodyImagePayload> {
    const locator = this.parseLocator(locatorValue);
    const archivePath = `${this.context.filesDir}/reader-import/books/${locator.hash}.epub`;
    if (!(await fileIo.access(archivePath))) {
      throw new Error('local EPUB source asset is unavailable; re-import is required');
    }
    const bytes = readLocalEpubEntry(archivePath, locator.archivePath, MAX_READING_IMAGE_BYTES);
    return ReadingBodyImageHost.instance.loadBytes(bytes);
  }

  private parseLocator(value: string): LocalEpubResourceLocator {
    if (!value.startsWith(LOCAL_EPUB_SCHEME)) {
      throw new Error('local EPUB image locator uses an unsupported scheme');
    }
    const tokens = value.substring(LOCAL_EPUB_SCHEME.length).split('/');
    if (tokens.length !== 2 || tokens[0].length === 0 || tokens[1].length === 0) {
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
