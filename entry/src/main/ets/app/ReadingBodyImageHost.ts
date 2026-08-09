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

/**
 * Narrow Host adapter for one body image already admitted by Core.
 *
 * It reuses the production `http.execute` transport and only adds the Host
 * work ArkUI pagination needs: bounded byte validation, intrinsic dimensions,
 * and one decoded PixelMap. Base64 is accepted only as a transient JSON
 * transport representation for remote/data-URI images; it is never retained
 * in reading-session state. This adapter owns no retry queue, disk cache, or
 * alternate URL semantics.
 */
export class ReadingBodyImageHost {
  static readonly instance: ReadingBodyImageHost = new ReadingBodyImageHost();

  async loadRequest(request: JsonObject): Promise<ReadingBodyImagePayload> {
    const response = await HttpExecuteHost.instance.execute(request);
    const status = response['status'];
    if (typeof status !== 'number' || !Number.isSafeInteger(status) || status < 200 || status >= 300) {
      throw new Error('reading body image request returned a non-success HTTP status');
    }
    const bodyBase64 = response['bodyBase64'];
    if (typeof bodyBase64 !== 'string' || bodyBase64.length === 0) {
      throw new Error('reading body image response did not contain bytes');
    }
    return this.decodeBase64(bodyBase64);
  }

  async loadDataUri(value: string): Promise<ReadingBodyImagePayload> {
    const match = /^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i.exec(value.trim());
    if (match === null) {
      throw new Error('reading body image data URI must be base64 image data');
    }
    return this.decodeBase64(match[2]);
  }

  async loadBytes(bytes: Uint8Array): Promise<ReadingBodyImagePayload> {
    if (bytes.length === 0 || bytes.length > MAX_READING_IMAGE_BYTES) {
      throw new Error(`reading body image must contain 1..${MAX_READING_IMAGE_BYTES} bytes`);
    }
    return this.decodeBytes(bytes);
  }

  private async decodeBase64(bodyBase64: string): Promise<ReadingBodyImagePayload> {
    const bytes = new util.Base64Helper().decodeSync(bodyBase64, util.Type.MIME);
    return this.decodeBytes(bytes);
  }

  private async decodeBytes(bytes: Uint8Array): Promise<ReadingBodyImagePayload> {
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
      const pixelMap = await imageSource.createPixelMap();
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

  private revisionFor(bytes: Uint8Array, width: number, height: number): string {
    let hash = 0x811C9DC5;
    for (const value of bytes) {
      hash = Math.imul(hash ^ value, 0x01000193) >>> 0;
    }
    return `body-image-v1:${width}x${height}:${hash.toString(16).padStart(8, '0')}`;
  }
}
