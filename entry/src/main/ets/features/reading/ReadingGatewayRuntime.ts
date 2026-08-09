import type { image } from '@kit.ImageKit';
import type {
  JsonObject,
  ReaderCoreResultEvent,
  RequestOptions,
} from '@reader/core-harmony';

export type ReadingGatewayImage = {
  pixelMap: image.PixelMap;
  width: number;
  height: number;
  revision: string;
};

/** The only Core request surface feature gateways may consume. */
export interface ReadingGatewayRuntime {
  request(
    method: string,
    params?: JsonObject,
    options?: RequestOptions,
  ): Promise<ReaderCoreResultEvent>;

  /**
   * Optional in pure gateway tests; production ReaderRuntimeOwner implements
   * it with Core `source.imageRequest` plus the existing Host HTTP adapter.
   */
  loadReadingImage?(
    sourceId: string,
    imageUrl: string,
    baseUrl: string | undefined,
    shouldCancel?: () => boolean,
  ): Promise<ReadingGatewayImage>;

  /** Releases one native image after the bounded chapter window evicts it. */
  releaseReadingImage?(pixelMap: image.PixelMap): void;
}
