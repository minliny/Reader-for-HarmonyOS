import { image } from '@kit.ImageKit';
import util from '@ohos.util';
import type { JsonObject } from '@reader/core-harmony';
import { HttpExecuteHost } from './HttpExecuteHost';

export type ReadingBodyImagePayload = {
  pixelMap: image.PixelMap;
  width: number;
  height: number;
  revision: string;
};

const MAX_READING_IMAGE_BYTES = 16 * 1024 * 1024;
// Four million decoded RGBA pixels keep one body image near a 16 MiB native
// surface while retaining enough density for a TabletExpanded page. Very
// tall/wide images also receive an explicit longest-edge cap.
const MAX_READING_IMAGE_PIXELS = 4 * 1024 * 1024;
const MAX_READING_IMAGE_DIMENSION = 4096;

/**
 * Narrow Host adapter for one body image already admitted by Core.
 *
 * It reuses the production `http.execute` transport and only adds the Host
 * work ArkUI pagination needs: bounded byte validation, intrinsic dimensions,
 * and one decoded PixelMap. Base64 is accepted only as a transient JSON
 * transport representation for remote/data-URI images; it is never retained
 * in reading-session state. Durable offline bytes remain owned by the narrow
 * ReadingImageDiskCache; this decoder owns no queue or URL semantics.
 */
export class ReadingBodyImageHost {
  static readonly instance: ReadingBodyImageHost = new ReadingBodyImageHost();

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
    const response = await HttpExecuteHost.instance.execute(
      request,
      undefined,
      (): boolean => isCurrent !== undefined && !isCurrent(),
    );
    this.assertCurrent(isCurrent);
    const status = response['status'];
    if (typeof status !== 'number' || !Number.isSafeInteger(status) || status < 200 || status >= 300) {
      throw new Error('reading body image request returned a non-success HTTP status');
    }
    const bodyBase64 = response['bodyBase64'];
    if (typeof bodyBase64 !== 'string' || bodyBase64.length === 0) {
      throw new Error('reading body image response did not contain bytes');
    }
    const bytes = new util.Base64Helper().decodeSync(bodyBase64, util.Type.MIME);
    this.assertCurrent(isCurrent);
    if (bytes.length === 0 || bytes.length > MAX_READING_IMAGE_BYTES) {
      throw new Error(`reading body image must contain 1..${MAX_READING_IMAGE_BYTES} bytes`);
    }
    return bytes;
  }

  async loadDataUri(value: string, isCurrent?: () => boolean): Promise<ReadingBodyImagePayload> {
    this.assertCurrent(isCurrent);
    const match = /^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i.exec(value.trim());
    if (match === null) {
      throw new Error('reading body image data URI must be base64 image data');
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

  release(pixelMap: image.PixelMap): void {
    try {
      pixelMap.release();
    } catch (_) {
      // Idempotent best effort at a teardown/eviction boundary.
    }
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
    this.assertCurrent(isCurrent);
    if (bytes.length === 0 || bytes.length > MAX_READING_IMAGE_BYTES) {
      throw new Error(`reading body image must contain 1..${MAX_READING_IMAGE_BYTES} bytes`);
    }
    const imageSource = image.createImageSource(bytes.buffer);
    if (imageSource === undefined) {
      throw new Error('reading body image format is not supported by this device');
    }
    try {
      const info = await imageSource.getImageInfo(0);
      const width = info.size.width;
      const height = info.size.height;
      if (!Number.isSafeInteger(width) || width <= 0 || !Number.isSafeInteger(height) || height <= 0) {
        throw new Error('reading body image returned invalid intrinsic dimensions');
      }
      const pixelCount = width * height;
      if (!Number.isSafeInteger(pixelCount) || pixelCount <= 0) {
        throw new Error('reading body image dimensions exceed the safe decode range');
      }
      const dimensionScale = MAX_READING_IMAGE_DIMENSION / Math.max(width, height);
      const pixelScale = Math.sqrt(MAX_READING_IMAGE_PIXELS / pixelCount);
      const scale = Math.min(1, dimensionScale, pixelScale);
      const options: image.DecodingOptions = { editable: false };
      if (scale < 1) {
        options.desiredSize = {
          width: Math.max(1, Math.floor(width * scale)),
          height: Math.max(1, Math.floor(height * scale)),
        };
      }
      const pixelMap = await imageSource.createPixelMap(options);
      try {
        this.assertCurrent(isCurrent);
      } catch (error) {
        this.release(pixelMap);
        throw error;
      }
      return {
        pixelMap,
        width,
        height,
        revision: this.revisionFor(bytes, width, height),
      };
    } finally {
      await imageSource.release();
    }
  }

  private assertCurrent(isCurrent?: () => boolean): void {
    if (isCurrent !== undefined && !isCurrent()) {
      throw new Error('reading body image request was cancelled');
    }
  }

  private revisionFor(bytes: Uint8Array, width: number, height: number): string {
    let hash = 0x811C9DC5;
    for (const value of bytes) {
      hash = Math.imul(hash ^ value, 0x01000193) >>> 0;
    }
    return `body-image-v1:${width}x${height}:${hash.toString(16).padStart(8, '0')}`;
  }
}
