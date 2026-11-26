import { uniformTypeDescriptor } from '@kit.ArkData';
import type { unifiedDataChannel, uniformDataStruct } from '@kit.ArkData';

export const BOOKSHELF_DROP_FILE_LIMIT = 50;

export interface BookshelfFileDrop {
  readonly uris: string[];
  readonly failure?: 'noLocalFile' | 'tooManyFiles';
}

export function bookshelfFileDropTypes(): uniformTypeDescriptor.UniformDataType[] {
  const types = uniformTypeDescriptor.UniformDataType;
  return [types.FILE_URI, types.FILE];
}

/** Keep OS-issued local file URIs intact so the Host can read using their grants. */
export function readBookshelfFileDrop(records: unifiedDataChannel.UnifiedRecord[]): BookshelfFileDrop {
  if (records.length > BOOKSHELF_DROP_FILE_LIMIT) return { uris: [], failure: 'tooManyFiles' };
  const types = uniformTypeDescriptor.UniformDataType;
  const uris = new Set<string>();
  for (const record of records) {
    try {
      let uri: string | undefined;
      if (record.getTypes().includes(types.FILE_URI)) {
        const data = record.getEntry(types.FILE_URI) as uniformDataStruct.FileUri | undefined;
        if (data?.uniformDataType === types.FILE_URI && data.fileType !== types.DIRECTORY) uri = data.oriUri;
      } else if (record.getType() === types.FILE) {
        uri = (record as unifiedDataChannel.File).uri;
      }
      if (typeof uri === 'string' && uri.startsWith('file://') && uri.length <= 8192 && !/[\u0000\r\n]/.test(uri)) {
        uris.add(uri);
      }
    } catch (_) {
      // One unreadable record does not prevent another file from being imported.
    }
  }
  return uris.size === 0 ? { uris: [], failure: 'noLocalFile' } : { uris: Array.from(uris) };
}
