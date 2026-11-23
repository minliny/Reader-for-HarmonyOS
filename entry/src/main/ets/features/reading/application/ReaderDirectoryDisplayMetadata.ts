import type { JsonObject } from '@reader/core-harmony';

/** Optional Core display facts; never chapter identity or readability. */
export interface ReaderDirectoryDisplayMetadata {
  displayTitle?: string;
  isVip?: boolean;
  isPay?: boolean;
  contextTitle?: string;
}

export function decodeReaderDirectoryDisplayMetadata(raw: JsonObject): ReaderDirectoryDisplayMetadata {
  const result: ReaderDirectoryDisplayMetadata = {};
  for (const key of ['displayTitle', 'contextTitle']) {
    const value = raw[key];
    if (value === undefined || value === null) continue;
    if (typeof value !== 'string' || Array.from(value).length > (key === 'contextTitle' ? 65536 : 1024))
      throw new Error(`directory ${key} is invalid`);
    if (key === 'displayTitle') result.displayTitle = value;
    else result.contextTitle = value;
  }
  for (const key of ['isVip', 'isPay']) {
    const value = raw[key];
    if (value === undefined || value === null) continue;
    if (typeof value !== 'boolean') throw new Error(`directory ${key} is invalid`);
    if (key === 'isVip') result.isVip = value;
    else result.isPay = value;
  }
  return result;
}
