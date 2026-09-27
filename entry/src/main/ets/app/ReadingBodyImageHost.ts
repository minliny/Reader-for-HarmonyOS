import type { MangaPlatformObservation, MangaPlatformObserver, MangaBodyDiagnosticState } from './MangaPlatformObservation';
import hilog from '@ohos.hilog';
import { image } from '@kit.ImageKit';
import util from '@ohos.util';
import fs from '@ohos.file.fs';
import cryptoFramework from '@ohos.security.cryptoFramework';
import type { JsonObject } from '@reader/core-harmony';
import { HttpExecuteHost } from './HttpExecuteHost';
import { readingImageHttpError } from './ReadingImageHttpError';

export interface MangaImageDecodeProfile {
  format: 'jpeg' | 'png' | 'webp'; encodedWidth?: number; encodedHeight?: number;
  allocationClass: 'scanline' | 'pngInterlaced' | 'fullFrame';
}
export interface MangaImageMetadataProof {
  status: 'present' | 'absent'; orientation: number | null; sha256: string; bytes: number; transferId?: string; decodeProfile?: MangaImageDecodeProfile;
}
export type MangaImageMetadataInspector = (bytes: Uint8Array, sha256: string, current: () => boolean) => Promise<MangaImageMetadataProof>;

export type ReadingBodyImagePayload = {
  /**
   * Kept optional for the shared DTO boundary. Production Harmony rendering
   * uses the file URI below; PixelMaps are decode-time validation/downsample
   * objects and are released before this payload is published.
   */
  pixelMap: image.PixelMap | undefined;
  /**
   * Decoded image materialized as an app-cache file. ArkUI renders the body
   * image from this `file://` URI: on this device Image(PixelMap) mounts but
   * never paints regardless of how the PixelMap is created, while file-backed
   * images render through the same loader as resource images.
   */
  fileUri: string;
  width: number;
  height: number;
  intrinsicWidth: number;
  intrinsicHeight: number;
  regionY?: number;
  revision: string;
};

type ReadingImageResourceRead = {
  consumers: Set<() => boolean>;
  task: Promise<ReadingBodyImagePayload>;
};

const MAX_READING_IMAGE_BYTES = 16 * 1024 * 1024;
// MIME base64 may contain line breaks, but must be bounded before trim, regex,
// or the synchronous platform decoder sees a source-controlled string.
const MAX_READING_IMAGE_DATA_URI_CHARS = Math.ceil(MAX_READING_IMAGE_BYTES / 3) * 4 + 4096;
const MAX_READING_IMAGE_PIXELS = 4 * 1024 * 1024;
// Conservative codec-surface admission, independently tunable from the fixed
// 1Mi-pixel manga output budget. This is not a total-process memory guarantee.
const MAX_MANGA_DECODE_WORKING_BYTES = 4 * 1024 * 1024;
const MAX_MANGA_OUTPUT_BYTES = 4 * 1024 * 1024;
const MAX_READING_IMAGE_DIMENSION = 4096;
const MAX_READING_DISPLAY_FILE_BYTES = 32 * 1024 * 1024;
const DISPLAY_CACHE_DIRECTORY = 'reader-body-display-v1';
const LEGACY_DISPLAY_FILE_PREFIX = 'reading-body-';
const LEGACY_DISPLAY_TEMP_PREFIX = '.reading-body-tmp-';

/**
 * Narrow Host adapter for one body image already admitted by Core.
 *
 * It reuses the production `http.execute` transport and only adds the Host
 * work ArkUI pagination needs: bounded byte validation, intrinsic dimensions,
 * and one materialized display file. Network images use bounded raw bytes;
 * Base64 remains only for explicit data-URI inputs and is never retained in
 * reading-session state. Durable offline bytes remain owned by
 * the narrow ReadingImageDiskCache; this adapter owns no queue or URL
 * semantics.
 */
export class ReadingBodyImageHost {
  private diagnosticObserver: MangaPlatformObserver | undefined;
  attachDiagnosticObserver(observer: MangaPlatformObserver, debug: boolean = false, buildMode: string = ''): () => void {
    if (debug !== true || buildMode !== 'debug' || this.diagnosticObserver !== undefined) throw new Error('MANGA_DIAGNOSTIC_UNAVAILABLE');
    this.diagnosticObserver = observer;
    return (): void => { if (this.diagnosticObserver === observer) this.diagnosticObserver = undefined; };
  }
  diagnosticState(debug: boolean = false, buildMode: string = ''): MangaBodyDiagnosticState {
    if (debug !== true || buildMode !== 'debug') throw new Error('MANGA_DIAGNOSTIC_UNAVAILABLE');
    let leases = 0;
    for (const value of this.displayFileReferences.values()) leases += value;
    return { files: this.displayFileReferences.size, leases, writes: this.displayFileWrites.size,
      removals: this.displayFileRemovals.size, reads: this.resourceReads.size };
  }
  private observeDiagnostic(event: MangaPlatformObservation): void {
    try { this.diagnosticObserver?.(event); } catch (_) { /* Diagnostics cannot change ownership or decoding. */ }
  }
  private mangaMetadataInspector: MangaImageMetadataInspector | undefined;
  private mangaMetadataProofs: util.LRUCache<string, MangaImageMetadataProof> | undefined;
  private mangaMetadataGeneration: number = 0;

  setMangaMetadataInspector(inspector?: MangaImageMetadataInspector): void {
    this.mangaMetadataGeneration++;
    this.mangaMetadataProofs?.clear();
    this.mangaMetadataInspector = inspector;
    if (inspector !== undefined && this.mangaMetadataProofs === undefined) this.mangaMetadataProofs = new util.LRUCache<string, MangaImageMetadataProof>(128);
  }

  static readonly instance: ReadingBodyImageHost = new ReadingBodyImageHost();
  private displayCacheDir: string | undefined = undefined;
  private readonly displayFileReferences: Map<string, number> = new Map<string, number>();
  private readonly displayFileWrites: Map<string, Promise<void>> = new Map<string, Promise<void>>();
  private readonly displayFileRemovals: Map<string, Promise<void>> = new Map<string, Promise<void>>();
  // These are aliases of live display-file references, not another cache:
  // the last session owner releases both the file and every resource alias.
  private readonly resourcePayloads: Map<string, ReadingBodyImagePayload> = new Map<string, ReadingBodyImagePayload>();
  private readonly resourceReads: Map<string, ReadingImageResourceRead> = new Map<string, ReadingImageResourceRead>();
  private resourceGeneration: number = 0;
  private displayCacheCleanupGeneration: number = 0;
  private nextTemporaryFile: number = 0;

  /** Configure and crash-clean the app-cache directory used for display files. */
  static setDisplayCacheDir(dir: string): void {
    ReadingBodyImageHost.instance.configureDisplayCache(dir);
  }

  async loadRequest(
    request: JsonObject,
    isCurrent?: () => boolean,
  ): Promise<ReadingBodyImagePayload> {
    return this.decodeBytes(await this.fetchRequestBytes(request, isCurrent), isCurrent);
  }

  /** Fetch bounded response bytes without allocating a PixelMap. */
  async fetchRequestBytes(
    request: JsonObject,
    isCurrent?: () => boolean,
  ): Promise<Uint8Array> {
    this.assertCurrent(isCurrent);
    const response = await HttpExecuteHost.instance.executeBytes(
      request,
      MAX_READING_IMAGE_BYTES,
      undefined,
      (): boolean => isCurrent !== undefined && !isCurrent(),
    );
    this.assertCurrent(isCurrent);
    const status = response['status'];
    if (typeof status !== 'number' || !Number.isSafeInteger(status) || status < 200 || status >= 300) {
      throw readingImageHttpError(typeof status === 'number' && Number.isSafeInteger(status) ? status : 0,
        response.headers, response.bytes, typeof request['url'] === 'string' ? request['url'] : '');
    }
    const bytes = response.bytes;
    this.assertCurrent(isCurrent);
    if (bytes.length === 0 || bytes.length > MAX_READING_IMAGE_BYTES) {
      throw new Error(`reading body image must contain 1..${MAX_READING_IMAGE_BYTES} bytes`);
    }
    return bytes;
  }

  async loadDataUri(value: string, isCurrent?: () => boolean): Promise<ReadingBodyImagePayload> {
    return this.decodeBytes(this.readDataUriBytes(value, isCurrent), isCurrent);
  }

  readDataUriBytes(value: string, isCurrent?: () => boolean): Uint8Array {
    this.assertCurrent(isCurrent);
    if (value.length > MAX_READING_IMAGE_DATA_URI_CHARS) {
      throw new Error(`reading body image data URI exceeds ${MAX_READING_IMAGE_BYTES} byte limit`);
    }
    const match = /^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i.exec(value.trim());
    if (match === null) {
      throw new Error('reading body image data URI must be base64 image data');
    }
    if (match[2].length > MAX_READING_IMAGE_DATA_URI_CHARS) {
      throw new Error(`reading body image data URI exceeds ${MAX_READING_IMAGE_BYTES} byte limit`);
    }
    const bytes = new util.Base64Helper().decodeSync(match[2], util.Type.MIME);
    this.assertCurrent(isCurrent);
    if (bytes.length === 0 || bytes.length > MAX_READING_IMAGE_BYTES) throw new Error('reading body image data URI byte limit');
    return bytes;
  }

  async loadBytes(bytes: Uint8Array, isCurrent?: () => boolean, mangaPosition?: number, mangaPreview: boolean = false): Promise<ReadingBodyImagePayload> {
    this.assertCurrent(isCurrent);
    if (bytes.length === 0 || bytes.length > MAX_READING_IMAGE_BYTES) {
      throw new Error(`reading body image must contain 1..${MAX_READING_IMAGE_BYTES} bytes`);
    }
    return this.decodeBytes(bytes, isCurrent, mangaPosition, mangaPreview);
  }

  /** Share an immutable local resource across active page/chapter owners.
   * Each caller receives its own existing display-file lease. Cancelling one
   * caller cannot cancel another, and no pixels survive the last lease. */
  async loadResource(resourceKey: string, readBytes: (current: () => boolean) => Promise<Uint8Array>,
    isCurrent?: () => boolean): Promise<ReadingBodyImagePayload> {
    this.assertCurrent(isCurrent);
    const generation = this.resourceGeneration;
    const current = (): boolean => generation === this.resourceGeneration && isCurrent?.() !== false;
    const retained = this.resourcePayloads.get(resourceKey);
    if (retained !== undefined && this.retainPayload(retained)) return { ...retained };
    let reading = this.resourceReads.get(resourceKey);
    if (reading === undefined) {
      const consumers = new Set<() => boolean>();
      consumers.add(current);
      const active = (): boolean => generation === this.resourceGeneration &&
        Array.from(consumers).some((consumer: () => boolean): boolean => consumer());
      const task = readBytes(active).then((bytes: Uint8Array): Promise<ReadingBodyImagePayload> =>
        this.loadBytes(bytes, active));
      reading = { consumers, task };
      this.resourceReads.set(resourceKey, reading);
    } else reading.consumers.add(current);
    let payload: ReadingBodyImagePayload | undefined;
    try {
      payload = await reading.task;
      this.assertCurrent(current);
      if (!this.retainPayload(payload)) throw new Error('reading body image resource was released');
      this.resourcePayloads.set(resourceKey, payload);
      return { ...payload };
    } finally {
      reading.consumers.delete(current);
      if (reading.consumers.size === 0) {
        if (this.resourceReads.get(resourceKey) === reading) this.resourceReads.delete(resourceKey);
        // The shared operation holds one lease until every waiting caller
        // has acquired its own reference or observed cancellation.
        if (payload !== undefined) this.release(payload.fileUri, payload.pixelMap);
      }
    }
  }

  private retainPayload(payload: ReadingBodyImagePayload): boolean {
    const path = this.pathFromFileUri(payload.fileUri);
    if (path === undefined) return false;
    const references = this.displayFileReferences.get(path);
    if (references === undefined) return false;
    this.displayFileReferences.set(path, references + 1);
    return true;
  }

  /** Decode-validate one offline resource without creating a display file. */
  async validateBytes(bytes: Uint8Array, isCurrent?: () => boolean, mangaPosition?: number): Promise<void> {
    this.assertCurrent(isCurrent);
    if (bytes.length === 0 || bytes.length > MAX_READING_IMAGE_BYTES) {
      throw new Error(`reading body image must contain 1..${MAX_READING_IMAGE_BYTES} bytes`);
    }
    await this.withDecodedPixelMap(bytes, isCurrent, async (): Promise<void> => undefined, mangaPosition);
  }

  /** Release one acquired display URI after its reading-session owner evicts it. */
  release(fileUri: string, pixelMap?: image.PixelMap): void {
    if (pixelMap !== undefined) {
      try {
        pixelMap.release();
      } catch (_) {
        // Compatibility-only native handles remain best-effort/idempotent.
      }
    }
    const path = this.pathFromFileUri(fileUri);
    if (path === undefined) {
      return;
    }
    const references = this.displayFileReferences.get(path);
    if (references === undefined) {
      return;
    }
    if (references > 1) {
      this.displayFileReferences.set(path, references - 1);
      return;
    }
    this.displayFileReferences.delete(path);
    for (const [key, payload] of this.resourcePayloads) {
      if (payload.fileUri === fileUri) this.resourcePayloads.delete(key);
    }
    this.removeDisplayFile(path);
  }

  /** Ability teardown fallback for resources whose UI owner was interrupted. */
  releaseAllDisplayFiles(): void {
    this.resourceGeneration += 1;
    this.mangaMetadataGeneration++;
    this.mangaMetadataProofs?.clear();
    this.resourcePayloads.clear();
    this.resourceReads.clear();
    for (const path of this.displayFileReferences.keys()) {
      this.removeDisplayFile(path);
    }
    this.displayFileReferences.clear();
  }

  private async decodeBytes(
    bytes: Uint8Array,
    isCurrent?: () => boolean,
    mangaPosition?: number,
    mangaPreview: boolean = false,
  ): Promise<ReadingBodyImagePayload> {
    const generation = this.resourceGeneration;
    const current = (): boolean => generation === this.resourceGeneration && isCurrent?.() !== false;
    this.assertCurrent(current);
    if (bytes.length === 0 || bytes.length > MAX_READING_IMAGE_BYTES) {
      throw new Error(`reading body image must contain 1..${MAX_READING_IMAGE_BYTES} bytes`);
    }
    const byteHash = await this.sha256(bytes);
    this.assertCurrent(current);
    return this.withDecodedPixelMap(bytes, current, async (
      pixelMap: image.PixelMap,
      width: number,
      height: number,
      downsampled: boolean,
      intrinsicWidth: number,
      intrinsicHeight: number,
      regionY?: number,
    ): Promise<ReadingBodyImagePayload> => {
      const hash = mangaPreview ? `${byteHash}-preview` : regionY === undefined ? byteHash : `${byteHash}-region-${regionY}`;
      this.assertCurrent(current);
      const fileUri = await this.materializeDisplayFile(bytes, pixelMap, width, height, hash, downsampled, generation);
      try {
        this.assertCurrent(current);
      } catch (error) {
        this.release(fileUri);
        throw error;
      }
      return {
        pixelMap: undefined,
        fileUri,
        width,
        height,
        intrinsicWidth,
        intrinsicHeight,
        regionY,
        revision: `body-image-v2:${width}x${height}:${hash}`,
      };
    }, mangaPosition, byteHash, mangaPreview);
  }

  /** Native format/frame checks remain authoritative. EXIF absence is proven
   * by Core's fixed OSS parser, because platform error 62980123 also covers
   * malformed EXIF and cannot safely be treated as "no orientation".
   */
  private async assertMangaImageMetadata(source: image.ImageSource, mimeType: string, bytes: Uint8Array,
    sha256: string, isCurrent?: () => boolean): Promise<MangaImageMetadataProof> {
    if (mimeType !== 'image/jpeg' && mimeType !== 'image/png' && mimeType !== 'image/webp') throw new Error('MANGA_REGION_FORMAT_UNSUPPORTED');
    let frames: number;
    try {
      frames = await source.getFrameCount();
      this.assertCurrent(isCurrent);
    } catch (error) {
      this.assertCurrent(isCurrent);
      throw new Error('MANGA_REGION_METADATA_UNAVAILABLE');
    }
    if (!Number.isSafeInteger(frames) || frames !== 1) throw new Error('MANGA_REGION_ANIMATION_UNSUPPORTED');
    const inspector = this.mangaMetadataInspector;
    if (inspector === undefined) throw new Error('MANGA_REGION_METADATA_UNAVAILABLE');
    const generation = this.mangaMetadataGeneration;
    const current = (): boolean => generation === this.mangaMetadataGeneration && isCurrent?.() !== false;
    const key = `${sha256}:${bytes.byteLength}`;
    try {
      this.assertCurrent(current);
      let proof = this.mangaMetadataProofs?.get(key);
      if (proof === undefined) {
        proof = await inspector(bytes, sha256, current);
        this.assertCurrent(current);
        if (proof.bytes !== bytes.byteLength || proof.sha256 !== sha256 || !/^[0-9a-f]{64}$/.test(proof.sha256) ||
          (proof.status !== 'present' && proof.status !== 'absent') ||
          (proof.status === 'absent' && proof.orientation !== null) ||
          (proof.orientation !== null && (!Number.isSafeInteger(proof.orientation) || proof.orientation < 1 || proof.orientation > 8))) throw new Error('MANGA_METADATA_PROOF_INVALID');
        this.mangaMetadataProofs?.put(key, proof);
      }
      return proof;
    } catch (error) {
      this.assertCurrent(current);
      hilog.warn(0x5244, 'Reader', 'Manga metadata inspection failed: %{private}s', error instanceof Error ? error.message : String(error));
      throw new Error('MANGA_REGION_METADATA_UNAVAILABLE');
    } finally {
      if (!current()) this.mangaMetadataProofs?.remove(key);
    }
  }

  /**
   * Decode through one bounded PixelMap, invoke the narrow consumer, and
   * release both native objects on every success/failure/cancellation path.
   */
  private async withDecodedPixelMap<T>(
    bytes: Uint8Array,
    isCurrent: (() => boolean) | undefined,
    consume: (
      pixelMap: image.PixelMap,
      width: number,
      height: number,
      downsampled: boolean,
      intrinsicWidth: number,
      intrinsicHeight: number,
      regionY?: number,
    ) => Promise<T>,
    mangaPosition?: number,
    byteHash?: string,
    mangaPreview: boolean = false,
  ): Promise<T> {
    if (mangaPreview && mangaPosition === undefined) throw new Error('MANGA_REGION_OUT_OF_RANGE');
    // Metadata proof hashes exactly this view. Native ImageSource accepts an
    // ArrayBuffer, so slice only partial views; full image buffers stay zero-copy.
    const encoded = bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength ? bytes.buffer : bytes.slice().buffer;
    const imageSource = image.createImageSource(encoded);
    if (imageSource === undefined) {
      throw new Error('reading body image format is not supported by this device');
    }
    if (this.diagnosticObserver !== undefined) this.observeDiagnostic({ stage: 'body', event: 'open', resource: 'source' });
    let pixelMap: image.PixelMap | undefined = undefined;
    try {
      const info = await imageSource.getImageInfo(0);
      const metadata = mangaPosition === undefined ? undefined : await this.assertMangaImageMetadata(imageSource, info.mimeType, bytes, byteHash ?? await this.sha256(bytes), isCurrent);
      const orientation = metadata?.orientation ?? 1;
      if (this.diagnosticObserver !== undefined) this.observeDiagnostic({ stage: 'body', event: 'metadata', orientation, format: metadata?.decodeProfile?.format, allocationClass: metadata?.decodeProfile?.allocationClass, encodedWidth: metadata?.decodeProfile?.encodedWidth, encodedHeight: metadata?.decodeProfile?.encodedHeight });
      const sourceWidth = info.size.width;
      const sourceHeight = info.size.height;
      if (!Number.isSafeInteger(sourceWidth) || sourceWidth <= 0 ||
        !Number.isSafeInteger(sourceHeight) || sourceHeight <= 0 || !Number.isSafeInteger(sourceWidth * sourceHeight)) {
        throw new Error('reading body image returned invalid intrinsic dimensions');
      }
      // ImageSource regions use encoded coordinates. Reading positions use the
      // orientation-normalized image; only the selected bounded tile is edited.
      const swapsAxes = orientation >= 5;
      const intrinsicWidth = swapsAxes ? sourceHeight : sourceWidth;
      const intrinsicHeight = swapsAxes ? sourceWidth : sourceHeight;
      let target = mangaPreview ? this.boundedDecodeSize(intrinsicWidth, intrinsicHeight, 1024 * 1024, 2048) : this.boundedDecodeSize(intrinsicWidth, intrinsicHeight);
      const options: image.DecodingOptions = { editable: orientation !== 1 };
      if (mangaPosition !== undefined) {
        options.desiredPixelFormat = image.PixelMapFormat.RGBA_8888;
        options.desiredDynamicRange = image.DecodingDynamicRange.SDR;
      }
      let regionY: number | undefined = undefined;
      let regionHeight: number | undefined = undefined;
      if (mangaPosition !== undefined) {
        if (!Number.isFinite(mangaPosition) || mangaPosition < 0 || mangaPosition > 1 || intrinsicWidth > MAX_READING_IMAGE_DIMENSION) {
          throw new Error('MANGA_REGION_OUT_OF_RANGE');
        }
        if (mangaPreview) {
          // Request a bounded native thumbnail before allocating any pixels.
          // The codec owns scaling; source bytes and normalized geometry stay intact.
          options.desiredSize = swapsAxes ? { width: target.height, height: target.width } : target;
          if (metadata?.decodeProfile?.allocationClass === 'scanline') {
            const requested = options.desiredSize;
            let accepted = false;
            // Match the platform's discrete native sampling, keeping the
            // largest fitting contain size without enlarging the output budget.
            for (const bucket of [1, 2, 4, 8]) {
              const candidate = { width: Math.min(requested.width, Math.max(1, Math.floor(sourceWidth / bucket))),
                height: Math.min(requested.height, Math.max(1, Math.floor(sourceHeight / bucket))) };
              const scale = Math.max(candidate.width / sourceWidth, candidate.height / sourceHeight);
              const actualBucket = scale > 0.5 ? 1 : scale > 0.25 ? 2 : scale > 0.125 ? 4 : 8;
              const workingBytes = Math.ceil(sourceWidth / actualBucket) * Math.ceil(sourceHeight / actualBucket) * 4;
              if (Number.isSafeInteger(workingBytes) && workingBytes <= MAX_MANGA_DECODE_WORKING_BYTES) {
                options.desiredSize = candidate;
                target = swapsAxes ? { width: candidate.height, height: candidate.width } : candidate;
                accepted = true; break;
              }
            }
            if (!accepted) throw new Error('MANGA_REGION_MEMORY_BUDGET');
          }
          if (info.mimeType === 'image/jpeg' || info.mimeType === 'image/png') {
            options.desiredRegion = { x: 0, y: 0, size: { width: sourceWidth, height: sourceHeight } };
            options.cropAndScaleStrategy = image.CropAndScaleStrategy.CROP_FIRST;
          }
        } else {
          const tileHeight = Math.min(intrinsicHeight, 2048, Math.max(1, Math.floor(1024 * 1024 / intrinsicWidth)));
          const targetY = Math.min(intrinsicHeight - 1, Math.floor(mangaPosition * intrinsicHeight + 0.000001));
          regionY = Math.floor(targetY / tileHeight) * tileHeight;
          regionHeight = Math.min(tileHeight, intrinsicHeight - regionY);
          if (swapsAxes) {
            const x = orientation >= 7 ? sourceWidth - regionY - regionHeight : regionY;
            options.desiredRegion = { x, y: 0, size: { width: regionHeight, height: sourceHeight } };
          } else {
            const y = orientation === 3 || orientation === 4 ? sourceHeight - regionY - regionHeight : regionY;
            options.desiredRegion = { x: 0, y, size: { width: sourceWidth, height: regionHeight } };
          }
          // The native codec only takes its crop-first path when both fields
          // are supplied. The size is in encoded coordinates, before EXIF.
          if (info.mimeType === 'image/jpeg' || info.mimeType === 'image/png') {
            options.desiredSize = { width: options.desiredRegion.size.width, height: options.desiredRegion.size.height };
            options.cropAndScaleStrategy = image.CropAndScaleStrategy.CROP_FIRST;
          }
        }
      } else if (target.width !== intrinsicWidth || target.height !== intrinsicHeight) {
        options.desiredSize = target;
      }
      if (mangaPosition !== undefined) {
        const profile = metadata?.decodeProfile;
        const format = info.mimeType.slice('image/'.length);
        if (profile !== undefined && (profile.format !== format ||
          (profile.allocationClass !== 'scanline' && profile.allocationClass !== 'pngInterlaced' && profile.allocationClass !== 'fullFrame') ||
          (profile.format === 'webp' && profile.allocationClass !== 'fullFrame') ||
          (profile.allocationClass === 'pngInterlaced' && profile.format !== 'png') ||
          ((profile.format === 'jpeg' || profile.format === 'png') &&
            (profile.encodedWidth !== sourceWidth || profile.encodedHeight !== sourceHeight)))) throw new Error('MANGA_REGION_METADATA_UNAVAILABLE');
        // This constrains known codec working surfaces, not total process/codec
        // peak memory. Missing older metadata never grants scanline admission.
        let intermediateBytes = sourceWidth * sourceHeight * (format === 'webp' ? 4 : 8);
        // JPEG component arrays also round to maximum sampling-factor (4) MCU blocks.
        if (format === 'jpeg') intermediateBytes = Math.ceil(sourceWidth / 32) * 32 * Math.ceil(sourceHeight / 32) * 32 * 8;
        if (profile?.allocationClass === 'pngInterlaced') {
          intermediateBytes = sourceWidth * (options.desiredRegion?.size.height ?? sourceHeight) * 4;
        } else if (profile?.allocationClass === 'scanline') {
          const region = options.desiredRegion!;
          if (mangaPreview) {
            // Native CROP_FIRST only offers 1/2/4/8 intermediate sampling;
            // a much smaller requested thumbnail does not remove that surface.
            const size = options.desiredSize!;
            const scale = Math.max(size.width / sourceWidth, size.height / sourceHeight);
            const sample = scale > 0.5 ? 1 : scale > 0.25 ? 2 : scale > 0.125 ? 4 : 8;
            intermediateBytes = Math.ceil(sourceWidth / sample) * Math.ceil(sourceHeight / sample) * 4;
          } else intermediateBytes = region.size.width * region.size.height * 4;
          // Scanline storage still contains an original-width row.
          intermediateBytes = Math.max(intermediateBytes, sourceWidth * 4);
        }
        if (!Number.isSafeInteger(intermediateBytes) || intermediateBytes <= 0 || intermediateBytes > MAX_MANGA_DECODE_WORKING_BYTES) throw new Error('MANGA_REGION_MEMORY_BUDGET');
      }
      this.assertCurrent(isCurrent);
      if (this.diagnosticObserver !== undefined) this.observeDiagnostic({ stage: 'body', event: 'region',
        width: options.desiredRegion?.size.width ?? options.desiredSize?.width ?? sourceWidth,
        height: options.desiredRegion?.size.height ?? options.desiredSize?.height ?? sourceHeight, regionY });
      pixelMap = await imageSource.createPixelMap(options);
      if (this.diagnosticObserver !== undefined) this.observeDiagnostic({ stage: 'body', event: 'open', resource: 'pixel' });
      this.assertCurrent(isCurrent);
      const rawInfo = await pixelMap.getImageInfo();
      if (mangaPosition !== undefined) this.assertMangaPixelBudget(pixelMap, rawInfo);
      if (!mangaPreview && options.desiredRegion !== undefined && (rawInfo.size.width !== options.desiredRegion.size.width || rawInfo.size.height !== options.desiredRegion.size.height)) {
        throw new Error('MANGA_REGION_DECODE_MISMATCH');
      }
      if (mangaPreview && options.desiredSize !== undefined && (rawInfo.size.width !== options.desiredSize.width || rawInfo.size.height !== options.desiredSize.height)) throw new Error('MANGA_REGION_DECODE_MISMATCH');
      this.assertCurrent(isCurrent);
      if (orientation === 2) await pixelMap.flip(true, false);
      else if (orientation === 3) await pixelMap.rotate(180);
      else if (orientation === 4) await pixelMap.flip(false, true);
      else if (orientation >= 5) {
        await pixelMap.rotate(orientation === 8 ? 270 : 90);
        this.assertCurrent(isCurrent);
        if (orientation === 5) await pixelMap.flip(true, false);
        else if (orientation === 7) await pixelMap.flip(false, true);
      }
      this.assertCurrent(isCurrent);
      const decodedInfo = orientation === 1 ? rawInfo : await pixelMap.getImageInfo();
      const width = decodedInfo.size.width;
      const height = decodedInfo.size.height;
      const decodedPixels = width * height;
      if (mangaPosition !== undefined) this.assertMangaPixelBudget(pixelMap, decodedInfo);
      if (!Number.isSafeInteger(width) || width <= 0 || width > MAX_READING_IMAGE_DIMENSION ||
        !Number.isSafeInteger(height) || height <= 0 || height > MAX_READING_IMAGE_DIMENSION ||
        !Number.isSafeInteger(decodedPixels) || decodedPixels > MAX_READING_IMAGE_PIXELS) {
        throw new Error('reading body image decoder exceeded the configured pixel budget');
      }
      if (mangaPreview && (width !== target.width || height !== target.height || decodedPixels > 1024 * 1024)) throw new Error('MANGA_REGION_TRANSFORM_MISMATCH');
      if (regionHeight !== undefined && (width !== intrinsicWidth || height !== regionHeight)) {
        throw new Error('MANGA_REGION_TRANSFORM_MISMATCH');
      }
      return await consume(pixelMap, width, height, options.desiredSize !== undefined || regionY !== undefined, intrinsicWidth, intrinsicHeight, regionY);
    } finally {
      if (pixelMap !== undefined) {
        try {
          await pixelMap.release();
          if (this.diagnosticObserver !== undefined) this.observeDiagnostic({ stage: 'body', event: 'release', resource: 'pixel' });
        } catch (_) {
          if (this.diagnosticObserver !== undefined) this.observeDiagnostic({ stage: 'body', event: 'release-error', resource: 'pixel' });
        }
      }
      try {
        await imageSource.release();
        if (this.diagnosticObserver !== undefined) this.observeDiagnostic({ stage: 'body', event: 'release', resource: 'source' });
      } catch (_) {
        if (this.diagnosticObserver !== undefined) this.observeDiagnostic({ stage: 'body', event: 'release-error', resource: 'source' });
        // The decoded PixelMap is already released and no native handle is
        // published. A platform release error must not orphan the display URI.
      }
    }
  }

  /**
   * Write one already-validated body image to the app cache so ArkUI can
   * render it by file URI. An atomic temp-rename keeps a concurrently read
   * image from observing a partially-written file.
   */
  private async materializeDisplayFile(
    bytes: Uint8Array,
    pixelMap: image.PixelMap,
    width: number,
    height: number,
    hash: string,
    downsampled: boolean,
    generation: number,
  ): Promise<string> {
    const dir = this.displayCacheDir;
    if (dir === undefined || dir.trim().length === 0) {
      throw new Error('reading body image display cache is not configured');
    }
    const extension = downsampled ? '.png' : this.imageExtensionFor(bytes);
    // A late release from the previous ability/session generation must not
    // decrement the current owner's lease for identical image bytes.
    const finalPath = `${dir}/reading-body-g${generation}-${width}x${height}-${hash}${extension}`;
    const existing = this.displayFileWrites.get(finalPath);
    if (existing !== undefined) {
      await existing;
      this.displayFileReferences.set(finalPath, (this.displayFileReferences.get(finalPath) ?? 0) + 1);
      return `file://${finalPath}`;
    }
    // Invalidate startup cleanup before the first temporary file can appear.
    // Otherwise cleanup and first-use materialization can race in this cache.
    this.displayCacheCleanupGeneration += 1;
    const write = this.performDisplayFileWrite(dir, finalPath, bytes, pixelMap, hash, downsampled);
    this.displayFileWrites.set(finalPath, write);
    try {
      await write;
    } finally {
      if (this.displayFileWrites.get(finalPath) === write) {
        this.displayFileWrites.delete(finalPath);
      }
    }
    this.displayFileReferences.set(finalPath, (this.displayFileReferences.get(finalPath) ?? 0) + 1);
    return `file://${finalPath}`;
  }

  private async performDisplayFileWrite(
    dir: string,
    finalPath: string,
    bytes: Uint8Array,
    pixelMap: image.PixelMap,
    hash: string,
    downsampled: boolean,
  ): Promise<void> {
    // A just-released page can still have an asynchronous unlink in flight.
    // Complete that removal before a newer page publishes the same path.
    await this.displayFileRemovals.get(finalPath);
    await this.ensureDirectory(dir);
    this.nextTemporaryFile += 1;
    const tmpPath = `${dir}/.reading-body-tmp-${hash}-${this.nextTemporaryFile}`;
    try {
      const file = await fs.open(tmpPath, fs.OpenMode.CREATE | fs.OpenMode.READ_WRITE | fs.OpenMode.TRUNC);
      try {
        if (downsampled) {
          const packer = image.createImagePacker();
          if (this.diagnosticObserver !== undefined) this.observeDiagnostic({ stage: 'body', event: 'open', resource: 'packer' });
          try {
            await packer.packToFile(pixelMap, file.fd, { format: 'image/png', quality: 100 });
          } finally {
            try {
              await packer.release();
              if (this.diagnosticObserver !== undefined) this.observeDiagnostic({ stage: 'body', event: 'release', resource: 'packer' });
            } catch (_) {
              if (this.diagnosticObserver !== undefined) this.observeDiagnostic({ stage: 'body', event: 'release-error', resource: 'packer' });
            }
          }
        } else {
          let writtenBytes = 0;
          while (writtenBytes < bytes.byteLength) {
            const chunk = bytes.slice(writtenBytes);
            const written = await fs.write(file.fd, chunk.buffer);
            if (!Number.isSafeInteger(written) || written <= 0 || written > chunk.byteLength) {
              throw new Error('reading body image display destination stopped accepting bytes');
            }
            writtenBytes += written;
          }
        }
        // This is a disposable display derivative, never the retained book
        // or offline original. Closing the completed write before atomic
        // rename is sufficient for the image loader; a durability barrier
        // on every page would stall pagination for no recoverable user data.
      } finally {
        await fs.close(file);
      }
      const displayBytes = (await fs.stat(tmpPath)).size;
      if (!Number.isSafeInteger(displayBytes) || displayBytes <= 0 ||
        displayBytes > MAX_READING_DISPLAY_FILE_BYTES) {
        throw new Error('reading body image display file exceeds the configured byte budget');
      }
      await fs.rename(tmpPath, finalPath);
    } catch (error) {
      await this.unlinkBestEffort(tmpPath);
      throw error;
    }
  }

  private removeDisplayFile(path: string): Promise<void> {
    const existing = this.displayFileRemovals.get(path);
    if (existing !== undefined) return existing;
    const writing = this.displayFileWrites.get(path);
    const removal = (async (): Promise<void> => {
      await writing;
      if (!this.displayFileReferences.has(path)) await this.unlinkBestEffort(path);
    })().catch((): void => {});
    this.displayFileRemovals.set(path, removal);
    void removal.finally((): void => {
      if (this.displayFileRemovals.get(path) === removal) this.displayFileRemovals.delete(path);
    });
    return removal;
  }

  private assertMangaPixelBudget(map: image.PixelMap, info: image.ImageInfo): void {
    const rowBytes = map.getBytesNumberPerRow();
    const bytes = map.getPixelBytesNumber();
    const minimumRow = info.size.width * 4;
    if (info.pixelFormat !== image.PixelMapFormat.RGBA_8888 ||
      !Number.isSafeInteger(rowBytes) || rowBytes < minimumRow ||
      !Number.isSafeInteger(bytes) || bytes < minimumRow * info.size.height ||
      !Number.isSafeInteger(rowBytes * info.size.height) || rowBytes * info.size.height > MAX_MANGA_OUTPUT_BYTES || bytes > MAX_MANGA_OUTPUT_BYTES) {
      throw new Error('MANGA_REGION_MEMORY_BUDGET');
    }
  }

  private boundedDecodeSize(width: number, height: number, pixelBudget: number = MAX_READING_IMAGE_PIXELS, dimensionLimit: number = MAX_READING_IMAGE_DIMENSION): image.Size {
    const dimensionScale = Math.min(
      1,
      dimensionLimit / width,
      dimensionLimit / height,
    );
    const pixelScale = Math.min(1, Math.sqrt(pixelBudget / (width * height)));
    const scale = Math.min(dimensionScale, pixelScale);
    return {
      width: Math.max(1, Math.floor(width * scale)),
      height: Math.max(1, Math.floor(height * scale)),
    };
  }

  private configureDisplayCache(cacheDir: string): void {
    if (cacheDir.trim().length === 0) {
      throw new Error('reading body image display cache is not configured');
    }
    const directory = `${cacheDir}/${DISPLAY_CACHE_DIRECTORY}`;
    this.releaseAllDisplayFiles();
    this.displayCacheDir = directory;
    const generation = ++this.displayCacheCleanupGeneration;
    void this.cleanupDisplayCache(cacheDir, directory, generation);
  }

  private async cleanupDisplayCache(cacheDir: string, directory: string, generation: number): Promise<void> {
    if (generation !== this.displayCacheCleanupGeneration || this.displayCacheDir !== directory ||
      this.displayFileReferences.size > 0) {
      return;
    }
    try {
      await this.ensureDirectory(directory);
      // Older builds materialized display files directly in cacheDir. Reclaim
      // only their exact prefixes so unrelated app-cache files remain untouched.
      for (const name of await fs.listFile(cacheDir)) {
        if (name.startsWith(LEGACY_DISPLAY_FILE_PREFIX) || name.startsWith(LEGACY_DISPLAY_TEMP_PREFIX)) {
          await this.removeDisplayFile(`${cacheDir}/${name}`);
        }
      }
      // Runtime installation happens before a reading session exists. Files
      // left by a process crash are therefore unreachable and can be reclaimed.
      for (const name of await fs.listFile(directory)) {
        const path = `${directory}/${name}`;
        if (generation !== this.displayCacheCleanupGeneration || this.displayFileReferences.has(path)) {
          continue;
        }
        // Join the same removal/write ordering as normal owner release.
        // Generation checks cannot cancel an unlink already inside the OS.
        await this.removeDisplayFile(path);
      }
    } catch (_) {
      // Cache cleanup is maintenance-only and must never block app startup.
    }
  }

  private pathFromFileUri(fileUri: string): string | undefined {
    const dir = this.displayCacheDir;
    if (dir === undefined || !fileUri.startsWith('file://')) {
      return undefined;
    }
    const path = fileUri.substring('file://'.length);
    if (!path.startsWith(`${dir}/reading-body-`)) {
      return undefined;
    }
    return path;
  }

  private async unlinkBestEffort(path: string): Promise<void> {
    try {
      if (await fs.access(path)) {
        await fs.unlink(path);
      }
    } catch (_) {
    }
  }

  private async ensureDirectory(path: string): Promise<void> {
    if (await fs.access(path)) {
      return;
    }
    try {
      await fs.mkdir(path, true);
    } catch (error) {
      if (!(await fs.access(path))) {
        throw error;
      }
    }
  }

  private imageExtensionFor(bytes: Uint8Array): string {
    if (bytes.length > 3 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
      return '.png';
    }
    if (bytes.length > 2 && bytes[0] === 0xFF && bytes[1] === 0xD8) {
      return '.jpg';
    }
    if (bytes.length > 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
      return '.webp';
    }
    return '.img';
  }

  private assertCurrent(isCurrent?: () => boolean): void {
    if (isCurrent !== undefined && !isCurrent()) {
      throw new Error('reading body image request was cancelled');
    }
  }

  private async sha256(bytes: Uint8Array): Promise<string> {
    const digest = cryptoFramework.createMd('SHA256');
    await digest.update({ data: bytes });
    const output = await digest.digest();
    let result = '';
    const alphabet = '0123456789abcdef';
    for (const value of output.data) {
      result += alphabet.charAt((value >>> 4) & 0x0F);
      result += alphabet.charAt(value & 0x0F);
    }
    return result;
  }
}
