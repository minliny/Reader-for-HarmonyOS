import { image } from '@kit.ImageKit';
import util from '@ohos.util';
import fs from '@ohos.file.fs';
import cryptoFramework from '@ohos.security.cryptoFramework';
import type { JsonObject } from '@reader/core-harmony';
import { HttpExecuteHost } from './HttpExecuteHost';

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
      throw new Error('reading body image request returned a non-success HTTP status');
    }
    const bytes = response.bytes;
    this.assertCurrent(isCurrent);
    if (bytes.length === 0 || bytes.length > MAX_READING_IMAGE_BYTES) {
      throw new Error(`reading body image must contain 1..${MAX_READING_IMAGE_BYTES} bytes`);
    }
    return bytes;
  }

  async loadDataUri(value: string, isCurrent?: () => boolean): Promise<ReadingBodyImagePayload> {
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
    return this.decodeBase64(match[2], isCurrent);
  }

  async loadBytes(bytes: Uint8Array, isCurrent?: () => boolean): Promise<ReadingBodyImagePayload> {
    this.assertCurrent(isCurrent);
    if (bytes.length === 0 || bytes.length > MAX_READING_IMAGE_BYTES) {
      throw new Error(`reading body image must contain 1..${MAX_READING_IMAGE_BYTES} bytes`);
    }
    return this.decodeBytes(bytes, isCurrent);
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
  async validateBytes(bytes: Uint8Array, isCurrent?: () => boolean): Promise<void> {
    this.assertCurrent(isCurrent);
    if (bytes.length === 0 || bytes.length > MAX_READING_IMAGE_BYTES) {
      throw new Error(`reading body image must contain 1..${MAX_READING_IMAGE_BYTES} bytes`);
    }
    await this.withDecodedPixelMap(bytes, isCurrent, async (): Promise<void> => undefined);
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
    this.resourcePayloads.clear();
    this.resourceReads.clear();
    for (const path of this.displayFileReferences.keys()) {
      this.removeDisplayFile(path);
    }
    this.displayFileReferences.clear();
  }

  private async decodeBase64(
    bodyBase64: string,
    isCurrent?: () => boolean,
  ): Promise<ReadingBodyImagePayload> {
    this.assertCurrent(isCurrent);
    const bytes = new util.Base64Helper().decodeSync(bodyBase64, util.Type.MIME);
    this.assertCurrent(isCurrent);
    return this.decodeBytes(bytes, isCurrent);
  }

  private async decodeBytes(
    bytes: Uint8Array,
    isCurrent?: () => boolean,
  ): Promise<ReadingBodyImagePayload> {
    const generation = this.resourceGeneration;
    const current = (): boolean => generation === this.resourceGeneration && isCurrent?.() !== false;
    this.assertCurrent(current);
    if (bytes.length === 0 || bytes.length > MAX_READING_IMAGE_BYTES) {
      throw new Error(`reading body image must contain 1..${MAX_READING_IMAGE_BYTES} bytes`);
    }
    return this.withDecodedPixelMap(bytes, current, async (
      pixelMap: image.PixelMap,
      width: number,
      height: number,
      downsampled: boolean,
      intrinsicWidth: number,
      intrinsicHeight: number,
    ): Promise<ReadingBodyImagePayload> => {
      const hash = await this.sha256(bytes);
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
        revision: `body-image-v2:${width}x${height}:${hash}`,
      };
    });
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
    ) => Promise<T>,
  ): Promise<T> {
    const imageSource = image.createImageSource(bytes.buffer);
    if (imageSource === undefined) {
      throw new Error('reading body image format is not supported by this device');
    }
    let pixelMap: image.PixelMap | undefined = undefined;
    try {
      const info = await imageSource.getImageInfo(0);
      const intrinsicWidth = info.size.width;
      const intrinsicHeight = info.size.height;
      if (!Number.isSafeInteger(intrinsicWidth) || intrinsicWidth <= 0 ||
        !Number.isSafeInteger(intrinsicHeight) || intrinsicHeight <= 0) {
        throw new Error('reading body image returned invalid intrinsic dimensions');
      }
      const pixelCount = intrinsicWidth * intrinsicHeight;
      if (!Number.isSafeInteger(pixelCount) || pixelCount <= 0) {
        throw new Error('reading body image dimensions exceed the safe decode range');
      }
      const target = this.boundedDecodeSize(intrinsicWidth, intrinsicHeight);
      const options: image.DecodingOptions = { editable: false };
      if (target.width !== intrinsicWidth || target.height !== intrinsicHeight) {
        options.desiredSize = target;
      }
      this.assertCurrent(isCurrent);
      pixelMap = await imageSource.createPixelMap(options);
      this.assertCurrent(isCurrent);
      const decodedInfo = await pixelMap.getImageInfo();
      const width = decodedInfo.size.width;
      const height = decodedInfo.size.height;
      const decodedPixels = width * height;
      if (!Number.isSafeInteger(width) || width <= 0 || width > MAX_READING_IMAGE_DIMENSION ||
        !Number.isSafeInteger(height) || height <= 0 || height > MAX_READING_IMAGE_DIMENSION ||
        !Number.isSafeInteger(decodedPixels) || decodedPixels > MAX_READING_IMAGE_PIXELS) {
        throw new Error('reading body image decoder exceeded the configured pixel budget');
      }
      return await consume(pixelMap, width, height, options.desiredSize !== undefined, intrinsicWidth, intrinsicHeight);
    } finally {
      if (pixelMap !== undefined) {
        try {
          pixelMap.release();
        } catch (_) {
        }
      }
      try {
        await imageSource.release();
      } catch (_) {
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
          try {
            await packer.packToFile(pixelMap, file.fd, { format: 'image/png', quality: 100 });
          } finally {
            try {
              await packer.release();
            } catch (_) {
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

  private boundedDecodeSize(width: number, height: number): image.Size {
    const dimensionScale = Math.min(
      1,
      MAX_READING_IMAGE_DIMENSION / width,
      MAX_READING_IMAGE_DIMENSION / height,
    );
    const pixelScale = Math.min(1, Math.sqrt(MAX_READING_IMAGE_PIXELS / (width * height)));
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
