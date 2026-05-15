// FileAccessAdapter — @ohos.file.fs wrapper for file operations
import { fileIo } from '@kit.CoreFileKit';

export interface FileAccessResult {
  data: Uint8Array;
  fileSize: number;
  mimeType?: string;
}

export class FileAccessAdapter {
  async readFile(path: string): Promise<FileAccessResult> {
    try {
      const file = fileIo.openSync(path, fileIo.OpenMode.READ_ONLY);
      const stat = fileIo.statSync(path);
      const buffer = new ArrayBuffer(stat.size);
      fileIo.readSync(file.fd, buffer);
      fileIo.closeSync(file);
      return {
        data: new Uint8Array(buffer),
        fileSize: stat.size,
        mimeType: this.guessMimeType(path)
      };
    } catch (e) {
      throw new Error(`FileAccessError: ${JSON.stringify(e)}`);
    }
  }

  async statFile(path: string): Promise<FileAccessResult> {
    try {
      const stat = fileIo.statSync(path);
      return { data: new Uint8Array(0), fileSize: stat.size, mimeType: this.guessMimeType(path) };
    } catch (e) {
      throw new Error(`FileAccessError: ${JSON.stringify(e)}`);
    }
  }

  async listDirectory(path: string): Promise<string[]> {
    try {
      const files = fileIo.listFileSync(path);
      return files;
    } catch (e) {
      return [];
    }
  }

  private guessMimeType(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'txt': return 'text/plain';
      case 'epub': return 'application/epub+zip';
      case 'pdf': return 'application/pdf';
      case 'html': return 'text/html';
      default: return 'application/octet-stream';
    }
  }
}
