import { common } from '@kit.AbilityKit';
import { uniformTypeDescriptor } from '@kit.ArkData';
import { url } from '@kit.ArkTS';
import { fileIo, fileUri } from '@kit.CoreFileKit';
import lazy { systemShare } from '@kit.ShareKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { readerHostCacheDirectory } from '../../app/diagnostics/ReaderPublicFixtureScope';
import { readerVmJourneyDocumentsEnabled } from '../../app/diagnostics/ReaderVmJourneyDocuments';
import type { ReaderShareFile, ReaderShareImage, ReaderShareRecord, SystemSharePort, SystemShareResult } from '../../features/reading/application/ReaderShareActions';

const SHARE_COPY_TTL_SECONDS = 24 * 60 * 60;
const SHARE_DISMISS_SETTLE_MS = 250;
let nextJourneyShare: number = 0;

function recordJourneyShare(sequence: number, phase: SystemShareResult | 'presented'): void {
  if (sequence > 0) hilog.info(0x5244, 'Reader', 'READER_JOURNEY_SHARE %{public}d %{public}s', sequence, phase);
}
export const READER_QUOTE_CARD_MAX_BYTES = 8 * 1024 * 1024;

interface ReaderPreparedBookShare {
  directory: string;
  data: systemShare.SharedRecord;
}

export function readerShareCachePath(context: common.UIAbilityContext): string {
  if (readerVmJourneyDocumentsEnabled()) return `${readerHostCacheDirectory(context.cacheDir)}/reader-share`;
  return `${context.getApplicationContext().cacheDir}/reader-share`;
}

export async function removeReaderShareCopy(directory: string): Promise<void> {
  try { await fileIo.rmdir(directory); } catch (_) { /* The app cache can also be evicted by the OS. */ }
}

export async function createReaderShareCopy(context: common.UIAbilityContext,
  kind: 'book' | 'quote', current: () => boolean): Promise<string | undefined> {
  const cache = readerShareCachePath(context);
  let cacheExists = false;
  try {
    cacheExists = await fileIo.access(cache);
  } catch (error) {
    const code = (error as { code?: number | string } | undefined)?.code;
    if (code !== 13900002 && code !== 'ENOENT') throw error;
  }
  if (!cacheExists) await fileIo.mkdir(cache, true);
  if (!(await fileIo.lstat(cache)).isDirectory()) return undefined;
  try {
    const expiresBefore = Date.now() / 1000 - SHARE_COPY_TTL_SECONDS;
    for (const name of await fileIo.listFile(cache)) {
      if (!/^(book|quote)-[a-zA-Z0-9]{6}$/.test(name)) continue;
      const directory = `${cache}/${name}`;
      try {
        const stat = await fileIo.lstat(directory);
        if (stat.isDirectory() && stat.mtime < expiresBefore) await removeReaderShareCopy(directory);
      } catch (error) {
        const code = (error as { code?: number | string } | undefined)?.code;
        if (code !== 13900002 && code !== 'ENOENT') throw error;
      }
    }
  } catch (_) { /* Cache eviction cannot prevent a new explicit share. */ }
  return current() ? fileIo.mkdtemp(`${cache}/${kind}-XXXXXX`) : undefined;
}

export class ReaderSystemShareHost implements SystemSharePort {
  private readonly context: () => common.UIAbilityContext | undefined;
  private readonly anchor: string | undefined;

  constructor(context: () => common.UIAbilityContext | undefined, anchor?: string) {
    this.context = context;
    this.anchor = anchor;
  }

  publicLink(value: string): string | undefined {
    const candidate = value.trim();
    if (!/^https?:\/\//i.test(candidate) || /[\s\\\u0000-\u001f\u007f]/.test(candidate) || candidate.includes(',{')) return undefined;
    try {
      const parsed = url.URL.parseURL(candidate);
      if (parsed.hostname.length === 0 || parsed.username || parsed.password) return undefined;
      const credential = /(?:^|[-_])(?:token|auth|authorization|session|cookie|password|secret|signature|apikey|sig|sid|key|credential)(?:$|[-_])/i;
      for (const key of parsed.params.keys()) {
        if (credential.test(key.replace(/([a-z])([A-Z])/g, '$1-$2'))) return undefined;
      }
      const fragment = decodeURIComponent(parsed.hash);
      if (fragment.includes('=') && credential.test(fragment.replace(/[#&=]/g, '-'))) return undefined;
      return parsed.toString();
    } catch (_) {
      return undefined;
    }
  }

  show(record: ReaderShareRecord, current: () => boolean): Promise<SystemShareResult> {
    const sequence = readerVmJourneyDocumentsEnabled() ? ++nextJourneyShare : 0;
    const result = this.showRecord(record, current, sequence);
    return sequence === 0 ? result : result.then((phase: SystemShareResult): SystemShareResult => {
      recordJourneyShare(sequence, phase);
      return phase;
    });
  }

  private async showRecord(record: ReaderShareRecord, current: () => boolean, sequence: number): Promise<SystemShareResult> {
    if (!current() || !canIUse('SystemCapability.Collaboration.SystemShare')) return 'unavailable';
    const context = this.context();
    if (context === undefined) return 'unavailable';
    if (record.kind === 'file') {
      const prepared = await this.originalFile(record, context, current);
      if (prepared === undefined) return current() ? 'unsafe' : 'dismissed';
      let result: SystemShareResult = 'unavailable';
      try {
        if (!current()) return 'dismissed';
        result = await this.present(context, prepared.data, true, sequence);
        return result;
      } finally {
        if (result !== 'shown') await removeReaderShareCopy(prepared.directory);
      }
    }
    if (record.kind === 'image') {
      const checked = await this.quoteImage(record, context);
      if (!current()) return 'dismissed';
      if (checked === undefined) return 'unsafe';
      return this.present(context, checked, true, sequence);
    }
    const utd = record.kind === 'link' ? uniformTypeDescriptor.UniformDataType.HYPERLINK :
      uniformTypeDescriptor.UniformDataType.PLAIN_TEXT;
    return this.present(context, { utd, content: record.text, title: record.title, description: record.description }, false, sequence);
  }

  private present(context: common.UIAbilityContext, data: systemShare.SharedRecord,
    hasStagedFile: boolean, sequence: number): Promise<SystemShareResult> {
    let controller: systemShare.ShareController;
    try { controller = new systemShare.ShareController(new systemShare.SharedData(data)); }
    catch (_) { return Promise.resolve('unavailable'); }
    return new Promise<SystemShareResult>((resolve): void => {
      let finished = false;
      let dismissTimer: number | undefined;
      const finish = (result: SystemShareResult): void => {
        if (finished) return;
        finished = true;
        if (dismissTimer !== undefined) clearTimeout(dismissTimer);
        try { controller.off('dismiss', dismiss); } catch (_) { /* The OS may have already released the panel. */ }
        try { controller.off('shareCompleted', complete); } catch (_) { /* The OS may have already released the panel. */ }
        resolve(result);
      };
      const dismiss = (): void => {
        if (!hasStagedFile) {
          finish('dismissed');
        } else if (dismissTimer === undefined) {
          // Completion can follow the generic panel-close event. Keep the URI
          // available while the two callbacks from the same interaction settle.
          dismissTimer = setTimeout((): void => finish('dismissed'), SHARE_DISMISS_SETTLE_MS);
        }
      };
      const complete = (_result: systemShare.ShareOperationResult): void => finish('shown');
      try {
        controller.on('dismiss', dismiss);
        controller.on('shareCompleted', complete);
        const showing = controller.show(context, { selectionMode: systemShare.SelectionMode.SINGLE, anchor: this.anchor });
        if (sequence > 0) void showing.then((): void => recordJourneyShare(sequence, 'presented'),
          (): void => finish('unavailable'));
        else void showing.catch((): void => finish('unavailable'));
      } catch (_) {
        finish('unavailable');
      }
    });
  }

  private async quoteImage(record: ReaderShareImage, context: common.UIAbilityContext):
    Promise<systemShare.SharedRecord | undefined> {
    const cache = readerShareCachePath(context);
    const suffix = record.path.slice(cache.length);
    if (!record.path.startsWith(cache) || !/^\/quote-[a-zA-Z0-9]{6}\/quote\.png$/.test(suffix)) return undefined;
    const directory = record.path.slice(0, record.path.lastIndexOf('/'));
    if (!(await fileIo.lstat(cache)).isDirectory() || !(await fileIo.lstat(directory)).isDirectory()) return undefined;
    const file = await fileIo.lstat(record.path);
    if (!file.isFile() || file.size <= 0 || file.size > READER_QUOTE_CARD_MAX_BYTES) return undefined;
    return { utd: uniformTypeDescriptor.UniformDataType.PNG, uri: fileUri.getUriFromPath(record.path), title: record.title };
  }

  private async originalFile(record: ReaderShareFile, context: common.UIAbilityContext,
    current: () => boolean): Promise<ReaderPreparedBookShare | undefined> {
    if (!/^[0-9a-f]{64}$/.test(record.hash) || !/^\.(txt|epub|mobi|azw|azw3)$/.test(record.extension)) return undefined;
    const importDir = `${context.filesDir}/reader-import`;
    const booksDir = `${importDir}/books`;
    const prefix = `${booksDir}/${record.hash}`;
    if (record.path !== `${prefix}.source` && (record.path !== `${prefix}.epub` || record.extension !== '.epub')) return undefined;
    // lstat checks the dedicated archive and the original without following a symlink.
    if (!(await fileIo.lstat(importDir)).isDirectory() || !(await fileIo.lstat(booksDir)).isDirectory() ||
      !(await fileIo.lstat(record.path)).isFile() || !current()) return undefined;
    // Publish a temporary copy with the book format extension. The private
    // archive is never granted to the receiving app or changed by its actions.
    const directory = await createReaderShareCopy(context, 'book', current);
    if (directory === undefined) return undefined;
    const title = Array.from(record.title.replace(/[\/\\:*?"<>|\u0000-\u001f\u007f]/g, '_').trim())
      .slice(0, 50).join('');
    const stem = title.length === 0 || title === '.' || title === '..' ? '书籍' : title;
    const name = stem.toLowerCase().endsWith(record.extension) ? stem : `${stem}${record.extension}`;
    const copy = `${directory}/${name}`;
    try {
      await fileIo.copyFile(record.path, copy);
      if (!current()) {
        await removeReaderShareCopy(directory);
        return undefined;
      }
      const type = uniformTypeDescriptor.getUniformDataTypeByFilenameExtension(record.extension);
      const utd = type.length > 0 && !type.startsWith('flex.') ? type : uniformTypeDescriptor.UniformDataType.FILE;
      return { directory, data: { utd, uri: fileUri.getUriFromPath(copy), title: record.title } };
    } catch (error) {
      await removeReaderShareCopy(directory);
      throw error;
    }
  }

}
