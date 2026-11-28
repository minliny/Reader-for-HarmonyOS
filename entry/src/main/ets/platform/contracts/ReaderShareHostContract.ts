export interface ReaderShareText {
  kind: 'text' | 'link';
  text: string;
  title?: string;
  description?: string;
}

export interface ReaderShareFile {
  kind: 'file';
  path: string;
  hash: string;
  extension: string;
  title: string;
}

export interface ReaderShareImage {
  kind: 'image';
  path: string;
  title: string;
}

export type ReaderShareRecord = ReaderShareText | ReaderShareFile | ReaderShareImage;
export type SystemShareResult = 'shown' | 'dismissed' | 'unavailable' | 'unsafe';

export interface SystemSharePort {
  publicLink(value: string): string | undefined;
  show(record: ReaderShareRecord, current: () => boolean): Promise<SystemShareResult>;
}
