import type { JsonObject, ReaderCoreAssetBridge, ReaderCoreHostRequestEvent, ReaderCoreResultEvent } from '@reader/core-harmony';
import type { MangaImageMetadataProof, MangaImageDecodeProfile } from './ReadingBodyImageHost';
interface MetadataTransfer {
  bytes: Uint8Array;
  sha256: string;
  current: () => boolean;
  requestId?: number;
  sent: boolean;
}
/** Metadata-only upload; never executes source rules or performs networking. */
export class MangaImageMetadataHost {
  static readonly instance: MangaImageMetadataHost = new MangaImageMetadataHost();
  private sequence: number = 0;
  private readonly transfers: Map<string, MetadataTransfer> = new Map<string, MetadataTransfer>();
  async inspect(bytes: Uint8Array, sha256: string, request: (params: JsonObject) => Promise<ReaderCoreResultEvent>,
    current: () => boolean): Promise<MangaImageMetadataProof> {
    if (!current()) throw new Error('MANGA_INSPECT_CANCELLED');
    if (bytes.length === 0 || bytes.length > 16777216 || !/^[0-9a-f]{64}$/.test(sha256)) throw new Error('MANGA_INSPECT_IDENTITY');
    if (this.transfers.size >= 4) throw new Error('MANGA_INSPECT_CAPACITY');
    const transferId = `manga-inspect-${++this.sequence}`;
    const transfer: MetadataTransfer = { bytes, sha256, current, sent: false };
    this.transfers.set(transferId, transfer);
    try {
      const result = await request({ transferId, sha256, bytes: bytes.length });
      const data = result.data;
      const status = data['status'];
      const orientation = data['orientation'];
      if (!current() || !transfer.sent || result.requestId !== transfer.requestId || data['transferId'] !== transferId ||
        data['sha256'] !== sha256 || data['bytes'] !== bytes.length ||
        (status !== 'present' && status !== 'absent') ||
        (status === 'absent' && orientation !== null) ||
        (status === 'present' && (typeof orientation !== 'number' || !Number.isSafeInteger(orientation) || orientation < 1 || orientation > 8))) {
        throw new Error('MANGA_INSPECT_RECEIPT');
      }
      const raw = data['decodeProfile'];
      let decodeProfile: MangaImageDecodeProfile | undefined;
      if (raw !== undefined) {
        if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('MANGA_INSPECT_RECEIPT');
        const profile = raw as JsonObject;
        const format = profile['format'];
        const allocationClass = profile['allocationClass'];
        const width = profile['encodedWidth'];
        const height = profile['encodedHeight'];
        if ((format !== 'jpeg' && format !== 'png' && format !== 'webp') ||
          (allocationClass !== 'scanline' && allocationClass !== 'pngInterlaced' && allocationClass !== 'fullFrame') ||
          (format === 'webp' && allocationClass !== 'fullFrame') ||
          (allocationClass === 'pngInterlaced' && format !== 'png') ||
          (width !== undefined && (typeof width !== 'number' || !Number.isSafeInteger(width) || width <= 0)) ||
          (height !== undefined && (typeof height !== 'number' || !Number.isSafeInteger(height) || height <= 0)) ||
          ((format === 'jpeg' || format === 'png') &&
            (typeof width !== 'number' || !Number.isSafeInteger(width) || width <= 0 || typeof height !== 'number' || !Number.isSafeInteger(height) || height <= 0))) throw new Error('MANGA_INSPECT_RECEIPT');
        decodeProfile = { format: format as 'jpeg' | 'png' | 'webp', allocationClass: allocationClass as 'scanline' | 'pngInterlaced' | 'fullFrame',
          encodedWidth: typeof width === 'number' ? width : undefined, encodedHeight: typeof height === 'number' ? height : undefined };
      }
      return { status: status as 'present' | 'absent', orientation: orientation as number | null, sha256, bytes: bytes.length, transferId, decodeProfile };
    } finally { this.transfers.delete(transferId); }
  }
  cancel(event: ReaderCoreHostRequestEvent): void {
    const id = event.params['transferId'];
    if (typeof id === 'string') this.transfers.delete(id);
  }
  async handle(event: ReaderCoreHostRequestEvent, bridge: ReaderCoreAssetBridge): Promise<JsonObject> {
    const id = event.params['transferId'];
    const transfer = typeof id === 'string' ? this.transfers.get(id) : undefined;
    if (transfer === undefined || transfer.sent || event.params['stage'] !== 'inspectInput' || event.params['sha256'] !== transfer.sha256 ||
      event.params['bytes'] !== transfer.bytes.length || event.params['maxBytes'] !== 16777216) throw new Error('MANGA_INSPECT_OWNER');
    const current = (): boolean => typeof id === 'string' && this.transfers.get(id) === transfer && transfer.current();
    if (!current()) throw new Error('MANGA_INSPECT_CANCELLED');
    transfer.requestId = event.requestId;
    const assetId = bridge.begin(event.requestId, event.operationId, transfer.bytes.length);
    try {
      for (let offset = 0; offset < transfer.bytes.length; offset += 1048576) {
        if (!current()) throw new Error('MANGA_INSPECT_CANCELLED');
        bridge.write(event.requestId, event.operationId, assetId, transfer.bytes.subarray(offset, Math.min(transfer.bytes.length, offset + 1048576)));
      }
      const count = bridge.commit(event.requestId, event.operationId, assetId);
      if (!current() || count !== transfer.bytes.length) throw new Error('MANGA_INSPECT_COMMIT');
      transfer.sent = true;
      return { assetId, operationId: event.operationId, bytes: count };
    } catch (error) { bridge.release(event.requestId, event.operationId, assetId); throw error; }
  }
}
