import { common } from '@kit.AbilityKit';
import { uniformTypeDescriptor } from '@kit.ArkData';
import { url } from '@kit.ArkTS';
import { fileIo, fileUri } from '@kit.CoreFileKit';
import { systemShare } from '@kit.ShareKit';
import type { ReaderShareFile, ReaderShareRecord, SystemSharePort, SystemShareResult } from '../../features/reading/application/ReaderShareActions';

const SHARE_COPY_TTL_SECONDS = 24 * 60 * 60;

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

  async show(record: ReaderShareRecord, current: () => boolean): Promise<SystemShareResult> {
    if (!current() || !canIUse('SystemCapability.Collaboration.SystemShare')) return 'unavailable';
    const context = this.context();
    if (context === undefined) return 'unavailable';
    let data: systemShare.SharedRecord;
    if (record.kind === 'file') {
      const checked = await this.originalFile(record, context, current);
      if (!current()) return 'dismissed';
      if (checked === undefined) return 'unsafe';
      data = checked;
    } else {
      const utd = record.kind === 'link' ? uniformTypeDescriptor.UniformDataType.HYPERLINK :
        uniformTypeDescriptor.UniformDataType.PLAIN_TEXT;
      data = { utd, content: record.text, title: record.title, description: record.description };
    }
    const controller = new systemShare.ShareController(new systemShare.SharedData(data));
    return new Promise<SystemShareResult>((resolve): void => {
      let finished = false;
      const finish = (result: SystemShareResult): void => {
        if (finished) return;
        finished = true;
        try { controller.off('dismiss', dismiss); } catch (_) { /* The OS may have already released the panel. */ }
        try { controller.off('shareCompleted', complete); } catch (_) { /* The OS may have already released the panel. */ }
        resolve(result);
      };
      const dismiss = (): void => finish('dismissed');
      const complete = (_result: systemShare.ShareOperationResult): void => finish('shown');
      try {
        controller.on('dismiss', dismiss);
        controller.on('shareCompleted', complete);
        controller.show(context, { selectionMode: systemShare.SelectionMode.SINGLE, anchor: this.anchor })
          .catch((): void => finish('unavailable'));
      } catch (_) {
        finish('unavailable');
      }
    });
  }

  private async originalFile(record: ReaderShareFile, context: common.UIAbilityContext,
    current: () => boolean): Promise<systemShare.SharedRecord | undefined> {
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
    const cache = `${context.getApplicationContext().cacheDir}/reader-share`;
    let cacheExists = false;
    try {
      cacheExists = await fileIo.access(cache);
    } catch (error) {
      const code = (error as { code?: number | string } | undefined)?.code;
      if (code !== 13900002 && code !== 'ENOENT') throw error;
    }
    if (!cacheExists) await fileIo.mkdir(cache, true);
    if (!(await fileIo.lstat(cache)).isDirectory()) return undefined;
    await this.removeExpiredCopies(cache);
    if (!current()) return undefined;
    const directory = await fileIo.mkdtemp(`${cache}/book-XXXXXX`);
    const title = Array.from(record.title.replace(/[\/\\:*?"<>|\u0000-\u001f\u007f]/g, '_').trim())
      .slice(0, 50).join('');
    const stem = title.length === 0 || title === '.' || title === '..' ? '书籍' : title;
    const name = stem.toLowerCase().endsWith(record.extension) ? stem : `${stem}${record.extension}`;
    const copy = `${directory}/${name}`;
    try {
      await fileIo.copyFile(record.path, copy);
      if (!current()) {
        await this.removeCopy(directory);
        return undefined;
      }
      const type = uniformTypeDescriptor.getUniformDataTypeByFilenameExtension(record.extension);
      const utd = type.length > 0 && !type.startsWith('flex.') ? type : uniformTypeDescriptor.UniformDataType.FILE;
      return { utd, uri: fileUri.getUriFromPath(copy), title: record.title };
    } catch (error) {
      await this.removeCopy(directory);
      throw error;
    }
  }

  private async removeExpiredCopies(cache: string): Promise<void> {
    try {
      const expiresBefore = Date.now() / 1000 - SHARE_COPY_TTL_SECONDS;
      for (const name of await fileIo.listFile(cache)) {
        if (!/^book-[a-zA-Z0-9]{6}$/.test(name)) continue;
        const directory = `${cache}/${name}`;
        try {
          const stat = await fileIo.lstat(directory);
          if (stat.isDirectory() && stat.mtime < expiresBefore) await this.removeCopy(directory);
        } catch (error) {
          const code = (error as { code?: number | string } | undefined)?.code;
          // The OS or another share may remove this entry after listing it.
          if (code !== 13900002 && code !== 'ENOENT') throw error;
        }
      }
    } catch (_) { /* Cache eviction cannot prevent a new explicit share. */ }
  }

  private async removeCopy(directory: string): Promise<void> {
    try { await fileIo.rmdir(directory); } catch (_) { /* The app cache can also be evicted by the OS. */ }
  }
}
