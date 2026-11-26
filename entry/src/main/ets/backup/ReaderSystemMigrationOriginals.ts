import fileIo from '@ohos.file.fs';

/** Shares the immutable local original layout with the app Host. */
export function readerLocalBookOriginalDirectory(filesDir: string): string {
  return `${filesDir}/reader-import/books`;
}

export class ReaderLocalRecoveryExportPort {
  private readonly directory: string;
  constructor(filesDir: string) { this.directory = readerLocalBookOriginalDirectory(filesDir); }

  async retainedLocalBookSourcePath(bookId: string, current: () => boolean): Promise<string | undefined> {
    const matched = /^local:([0-9a-f]{64})$/.exec(bookId);
    if (matched === null || !current()) return undefined;
    for (const extension of ['source', 'epub']) {
      const path = `${this.directory}/${matched[1]}.${extension}`;
      const exists = await fileIo.access(path);
      if (!current()) return undefined;
      if (exists) return path;
    }
    return undefined;
  }
}
