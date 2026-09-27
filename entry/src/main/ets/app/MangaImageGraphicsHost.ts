import { DEBUG, BUILD_MODE_NAME } from '../../../../build/default/generated/profile/default/BuildProfile';
import type { MangaPlatformObservation, MangaPlatformObserver } from './MangaPlatformObservation';
import { image } from '@kit.ImageKit';
import type { JsonObject } from '@reader/core-harmony';
import { validateMangaGraphicsDimensions, validateMangaGraphicsPlan } from './MangaImageGraphicsPlan';
import type { MangaImageGraphicsAdapter, MangaGraphicsDimensions } from './MangaImageGraphicsPlan';

const MAX_BYTES: number = 16 * 1024 * 1024;
/** Narrow Reader API mapping; platform ImageKit owns pixels and JPEG encoding. */
export class MangaImageGraphicsHost implements MangaImageGraphicsAdapter {
  static readonly instance: MangaImageGraphicsHost = new MangaImageGraphicsHost();
  private diagnosticObserver: MangaPlatformObserver | undefined;
  attachDiagnosticObserver(observer: MangaPlatformObserver): () => void {
    if (DEBUG !== true || BUILD_MODE_NAME !== 'debug' || this.diagnosticObserver !== undefined) throw new Error('MANGA_DIAGNOSTIC_UNAVAILABLE');
    this.diagnosticObserver = observer;
    return (): void => { if (this.diagnosticObserver === observer) this.diagnosticObserver = undefined; };
  }
  diagnosticPending(): number {
    if (DEBUG !== true || BUILD_MODE_NAME !== 'debug') throw new Error('MANGA_DIAGNOSTIC_UNAVAILABLE');
    return this.pending;
  }
  private observeDiagnostic(event: MangaPlatformObservation): void {
    try { this.diagnosticObserver?.(event); } catch (_) { /* Observation never changes the transform. */ }
  }
  private pending: number = 0;
  private tail: Promise<void> = Promise.resolve();

  private current(check: () => boolean): void {
    if (!check()) throw new Error('MANGA_DECODE_CANCELLED');
  }
  private encoded(bytes: Uint8Array): ArrayBuffer {
    if (bytes.length < 1 || bytes.length > MAX_BYTES) throw new Error('MANGA_GRAPHICS_BYTES');
    return bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength ? bytes.buffer as ArrayBuffer : bytes.slice().buffer as ArrayBuffer;
  }
  private async dimensions(source: image.ImageSource, current: () => boolean): Promise<MangaGraphicsDimensions> {
    const info = await source.getImageInfo(0);
    this.current(current);
    if (info.mimeType !== 'image/jpeg' && info.mimeType !== 'image/png' && info.mimeType !== 'image/webp') throw new Error('MANGA_GRAPHICS_FORMAT');
    if (await source.getFrameCount() !== 1) throw new Error('MANGA_GRAPHICS_ANIMATION');
    this.current(current);
    return validateMangaGraphicsDimensions(info.size.width, info.size.height);
  }
  async inspect(bytes: Uint8Array, current: () => boolean): Promise<MangaGraphicsDimensions> {
    this.current(current);
    const source = image.createImageSource(this.encoded(bytes));
    if (source === undefined) throw new Error('MANGA_GRAPHICS_SOURCE');
    if (this.diagnosticObserver !== undefined) this.observeDiagnostic({ stage: 'graphics', event: 'open', resource: 'source' });
    try { return await this.dimensions(source, current); }
    finally { await source.release(); if (this.diagnosticObserver !== undefined) this.observeDiagnostic({ stage: 'graphics', event: 'release', resource: 'source' }); }
  }
  async transform(bytes: Uint8Array, value: JsonObject, current: () => boolean): Promise<Uint8Array> {
    this.current(current);
    validateMangaGraphicsPlan(value);
    if (this.pending >= 2) throw new Error('MANGA_GRAPHICS_CAPACITY');
    this.pending++;
    const previous = this.tail;
    let release: () => void = (): void => {};
    this.tail = new Promise<void>((resolve: () => void): void => { release = resolve; });
    try {
      await previous;
      this.current(current);
      return await this.performTransform(bytes, value, current);
    } finally { this.pending--; release(); }
  }
  private async performTransform(bytes: Uint8Array, value: JsonObject, current: () => boolean): Promise<Uint8Array> {
    this.current(current);
    const plan = validateMangaGraphicsPlan(value);
    const source = image.createImageSource(this.encoded(bytes));
    if (source === undefined) throw new Error('MANGA_GRAPHICS_SOURCE');
    if (this.diagnosticObserver !== undefined) this.observeDiagnostic({ stage: 'graphics', event: 'open', resource: 'source' });
    let input: image.PixelMap | undefined = undefined;
    let output: image.PixelMap | undefined = undefined;
    let packer: image.ImagePacker | undefined = undefined;
    try {
      const size = await this.dimensions(source, current);
      if (size.width !== plan.width || size.height !== plan.height) throw new Error('MANGA_GRAPHICS_SIZE_CHANGED');
      input = await source.createPixelMap({ desiredPixelFormat: image.PixelMapFormat.RGBA_8888, editable: false });
      if (this.diagnosticObserver !== undefined) this.observeDiagnostic({ stage: 'graphics', event: 'open', resource: 'pixel' });
      this.current(current);
      const decoded = await input.getImageInfo();
      if (decoded.size.width !== plan.width || decoded.size.height !== plan.height || decoded.pixelFormat !== image.PixelMapFormat.RGBA_8888) {
        throw new Error('MANGA_GRAPHICS_DECODE_SIZE');
      }
      // ImageKit performs regional reads directly into the destination layout.
      // Reader supplies coordinates only; no codec or pixel conversion loop.
      const pixels = new ArrayBuffer(plan.width * plan.height * 4);
      for (let i = 0; i < plan.strips.length; i++) {
        this.current(current);
        const strip = plan.strips[i];
        await input.readPixels({ pixels, offset: strip.targetY * plan.width * 4, stride: plan.width * 4,
          region: { x: 0, y: strip.sourceY, size: { width: plan.width, height: strip.height } } });
        this.current(current);
      }
      if (this.diagnosticObserver !== undefined) this.observeDiagnostic({ stage: 'graphics', event: 'pre-encode', width: plan.width, height: plan.height, pixels: new Uint8Array(pixels) });
      await input.release(); input = undefined;
      if (this.diagnosticObserver !== undefined) this.observeDiagnostic({ stage: 'graphics', event: 'release', resource: 'pixel' });
      output = await image.createPixelMap(pixels, { size, srcPixelFormat: image.PixelMapFormat.RGBA_8888,
        pixelFormat: image.PixelMapFormat.RGB_565, editable: false });
      if (this.diagnosticObserver !== undefined) this.observeDiagnostic({ stage: 'graphics', event: 'open', resource: 'pixel' });
      this.current(current);
      packer = image.createImagePacker();
      if (this.diagnosticObserver !== undefined) this.observeDiagnostic({ stage: 'graphics', event: 'open', resource: 'packer' });
      const encoded = await packer.packing(output, { format: 'image/jpeg', quality: 90, bufferSize: MAX_BYTES });
      this.current(current);
      const result = new Uint8Array(encoded);
      if (result.length < 1 || result.length > MAX_BYTES) throw new Error('MANGA_GRAPHICS_OUTPUT_BUDGET');
      return result;
    } finally {
      try { if (packer !== undefined) { await packer.release(); if (this.diagnosticObserver !== undefined) this.observeDiagnostic({ stage: 'graphics', event: 'release', resource: 'packer' }); } }
      finally {
        try { if (output !== undefined) { await output.release(); if (this.diagnosticObserver !== undefined) this.observeDiagnostic({ stage: 'graphics', event: 'release', resource: 'pixel' }); } }
        finally {
          try { if (input !== undefined) { await input.release(); if (this.diagnosticObserver !== undefined) this.observeDiagnostic({ stage: 'graphics', event: 'release', resource: 'pixel' }); } }
          finally { await source.release(); if (this.diagnosticObserver !== undefined) this.observeDiagnostic({ stage: 'graphics', event: 'release', resource: 'source' }); }
        }
      }
    }
  }
}
