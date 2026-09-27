// Fixed-input DEBUG qualification only. Native ImageKit and Core metadata run
// unchanged; independent Pillow fixture pixels never enter a production path.
import { image } from '@kit.ImageKit';
import fs from '@ohos.file.fs';
import cryptoFramework from '@ohos.security.cryptoFramework';
import util from '@ohos.util';
import type { JsonObject } from '@reader/core-harmony';
import { DEBUG, BUILD_MODE_NAME } from '../../../../build/default/generated/profile/default/BuildProfile';
import { ReaderRuntimeOwner } from './ReaderRuntimeOwner';
import { ReadingBodyImageHost, type ReadingBodyImagePayload } from './ReadingBodyImageHost';
import { MangaImageGraphicsHost } from './MangaImageGraphicsHost';
import { MANGA_PLATFORM_FIXTURES, MANGA_PLATFORM_GRAPHICS, type MangaPlatformFixture } from './MangaPlatformFixtures';
import type { MangaPlatformObservation, MangaBodyDiagnosticState } from './MangaPlatformObservation';

export interface MangaProbeFrame { id: string; fileUri: string; width: number; height: number; }
export interface MangaProbePixels { width: number; height: number; rgba: Uint8Array; }
export interface MangaProbeDifference { maximum: number; mean: number; different: number; }
export interface MangaProbeReceipt {
  caseId: string; phase: string; pass: boolean; message?: string;
  width?: number; height?: number; orientation?: number; regions?: number; sha256?: string; expectedSha256?: string;
  maximum?: number; mean?: number; sourceBalance?: number; pixelBalance?: number; packerBalance?: number;
  releaseErrors?: number; displayCallback?: boolean; retainedDisplayLeases?: number;
  presentationEvidence: boolean;
}
const PREFIX = 'manga-platform-probe-v1/';
const MAX_FIXTURE_BYTES = 1024 * 1024;
const MAX_FIXTURE_PIXELS = 1024 * 1024;

export function mangaProbeDifference(actual: Uint8Array, expected: Uint8Array): MangaProbeDifference {
  if (actual.length !== expected.length || actual.length === 0 || actual.length > MAX_FIXTURE_PIXELS * 4) throw new Error('MANGA_PROBE_PIXEL_LENGTH');
  let maximum = 0, total = 0, different = 0;
  for (let i = 0; i < actual.length; i++) {
    const delta = Math.abs(actual[i] - expected[i]);
    maximum = Math.max(maximum, delta); total += delta; if (delta !== 0) different++;
  }
  return { maximum, mean: total / actual.length, different };
}
async function digest(bytes: Uint8Array): Promise<string> {
  const md = cryptoFramework.createMd('SHA256');
  await md.update({ data: bytes });
  const hash = await md.digest();
  const alphabet = '0123456789abcdef';
  let result = '';
  for (const byte of hash.data) result += alphabet.charAt(byte >>> 4) + alphabet.charAt(byte & 15);
  return result;
}
/** Diagnostic readback owns and releases its own native objects too. */
async function readPixels(source: image.ImageSource): Promise<MangaProbePixels> {
  let map: image.PixelMap | undefined;
  try {
    const info = await source.getImageInfo(0);
    if (info.size.width * info.size.height > MAX_FIXTURE_PIXELS) throw new Error('MANGA_PROBE_READBACK_BUDGET');
    map = await source.createPixelMap({ desiredPixelFormat: image.PixelMapFormat.RGBA_8888, editable: false });
    const actual = await map.getImageInfo();
    if (actual.pixelFormat !== image.PixelMapFormat.RGBA_8888 || actual.size.width !== info.size.width || actual.size.height !== info.size.height) throw new Error('MANGA_PROBE_READBACK_FORMAT');
    const pixels = new ArrayBuffer(actual.size.width * actual.size.height * 4);
    await map.readPixelsToBuffer(pixels);
    return { width: actual.size.width, height: actual.size.height, rgba: new Uint8Array(pixels) };
  } finally {
    try { if (map !== undefined) await map.release(); }
    finally { await source.release(); }
  }
}

export class MangaPlatformProbeRunner {
  private cancelled: boolean = false;
  private task: Promise<void> | undefined;
  private frame: ReadingBodyImagePayload | undefined;
  private readonly releasedFiles: Set<string> = new Set<string>();
  private baseline: MangaBodyDiagnosticState | undefined;
  private sources: number = 0;
  private pixels: number = 0;
  private packers: number = 0;
  private releaseErrors: number = 0;
  private observationErrors: number = 0;
  private regions: number = 0;
  private orientationProof: number = 0;
  private preEncoded: Uint8Array | undefined;
  private cancelAtPixel: boolean = false;
  private nativeCancelled: boolean = false;
  private sequence: number = 0;
  private readonly body: ReadingBodyImageHost = ReadingBodyImageHost.instance;
  private readonly graphics: MangaImageGraphicsHost = MangaImageGraphicsHost.instance;
  constructor(private readonly raw: (file: string) => Promise<Uint8Array>,
    private readonly emit: (result: MangaProbeReceipt) => void,
    private readonly display: (frame: MangaProbeFrame) => Promise<boolean>) {}

  private current = (): boolean => !this.cancelled && !this.nativeCancelled;
  private observe = (event: MangaPlatformObservation): void => {
    const delta = event.event === 'open' ? 1 : event.event === 'release' ? -1 : 0;
    if (event.resource === 'source') this.sources += delta;
    if (event.resource === 'pixel') this.pixels += delta;
    if (event.resource === 'packer') this.packers += delta;
    if (event.event === 'release-error') this.releaseErrors++;
    if (this.sources < 0 || this.pixels < 0 || this.packers < 0) this.observationErrors++;
    if (event.event === 'metadata') this.orientationProof = event.orientation ?? 0;
    if (event.event === 'region') {
      this.regions++;
      if ((event.width ?? 0) <= 0 || (event.height ?? 0) <= 0 || (event.width ?? 0) * (event.height ?? 0) > MAX_FIXTURE_PIXELS) this.observationErrors++;
    }
    if (event.event === 'pre-encode') {
      // This fixture is 8*103 RGBA pixels. Never copy arbitrary production bytes.
      if (event.pixels?.length !== 8 * 103 * 4) this.observationErrors++;
      else this.preEncoded = event.pixels.slice();
    }
    if (this.cancelAtPixel && event.event === 'open' && event.resource === 'pixel') this.nativeCancelled = true;
  };
  private report(value: MangaProbeReceipt): void { this.emit(value); }
  private check(condition: boolean, reason: string): void { if (!condition) throw new Error(reason); }
  private async bytes(name: string, expected: string): Promise<Uint8Array> {
    // Only names from the compiled fixture manifest reach this method.
    this.check(/^[a-z0-9.-]+$/.test(name), 'MANGA_PROBE_ASSET_NAME');
    const value = await this.raw(PREFIX + name);
    this.check(value.length > 0 && value.length <= MAX_FIXTURE_BYTES, 'MANGA_PROBE_ASSET_BUDGET');
    this.check(await digest(value) === expected, 'MANGA_PROBE_ASSET_DIGEST');
    return value;
  }
  private async pixelsOf(payload: ReadingBodyImagePayload): Promise<MangaProbePixels> {
    const file = await fs.open(payload.fileUri.slice('file://'.length), fs.OpenMode.READ_ONLY);
    try { return await readPixels(image.createImageSource(file.fd)); }
    finally { await fs.close(file); }
  }
  private release(payload: ReadingBodyImagePayload): void {
    this.releasedFiles.add(payload.fileUri.slice('file://'.length));
    this.body.release(payload.fileUri, payload.pixelMap);
  }
  private balanced(): boolean { return this.sources === 0 && this.pixels === 0 && this.packers === 0 && this.releaseErrors === 0 && this.observationErrors === 0; }
  private async settleDisplay(): Promise<boolean> {
    const baseline = this.baseline;
    if (baseline === undefined) return false;
    for (let attempt = 0; attempt < 40; attempt++) {
      const state = this.body.diagnosticState();
      if (state.files === baseline.files && state.leases === baseline.leases && state.writes === baseline.writes && state.removals === baseline.removals && state.reads === baseline.reads) {
        let absent = true;
        for (const path of this.releasedFiles) if (await fs.access(path)) absent = false;
        if (absent) return true;
      }
      await new Promise<void>((resolve: () => void): void => { setTimeout(resolve, 50); });
    }
    return false;
  }
  private async orientation(fixture: MangaPlatformFixture, preview: boolean = false): Promise<void> {
    const encoded = await this.bytes(fixture.file, fixture.sha256);
    const expected = await this.bytes(fixture.expectedFile, fixture.expectedSha256);
    const output = new Uint8Array(expected.length);
    let count = 0;
    const height = Math.min(fixture.height, 2048, Math.floor(MAX_FIXTURE_PIXELS / fixture.width));
    for (let y = 0; y < fixture.height; y += height) {
      this.check(this.current(), 'MANGA_PROBE_CANCELLED');
      const payload = await this.body.loadBytes(encoded, this.current, y / fixture.height, preview);
      try {
        this.check(this.orientationProof === fixture.orientation, 'MANGA_PROBE_NATIVE_METADATA');
        this.check(payload.intrinsicWidth === fixture.width && payload.intrinsicHeight === fixture.height, 'MANGA_PROBE_INTRINSIC');
        const actual = await this.pixelsOf(payload);
        this.check(actual.width === payload.width && actual.height === payload.height, 'MANGA_PROBE_DISPLAY_SIZE');
        if (preview) {
          this.check(actual.width === fixture.previewWidth && actual.height === fixture.previewHeight, 'MANGA_PROBE_CONTAIN_DIMENSIONS');
          this.check(actual.width <= 2048 && actual.height <= 2048 && actual.width * actual.height <= MAX_FIXTURE_PIXELS && payload.regionY === undefined, 'MANGA_PROBE_CONTAIN_BUDGET');
          // Small 3x2 fixtures do not scale: exact oriented pixels remain an
          // independent oracle. Long-image preview records native scale output.
          if (fixture.height <= 2048) {
            const error = mangaProbeDifference(actual.rgba, expected);
            this.check(error.maximum <= (fixture.lossy ? 3 : 0), 'MANGA_PROBE_CONTAIN_PIXELS');
          }
          this.report({ caseId: fixture.id, phase: 'contain', pass: true, width: actual.width, height: actual.height, orientation: this.orientationProof,
            sha256: await digest(actual.rgba), message: fixture.height > 2048 ? 'bounded native thumbnail; scaling pixels observed, no cross-codec scaling-equivalence claim' : 'independent oriented pixel oracle', presentationEvidence: false });
          return;
        }
        this.check(payload.regionY === y && actual.width === fixture.width && actual.height === Math.min(height, fixture.height - y), 'MANGA_PROBE_REGION_COORDINATES');
        output.set(actual.rgba, y * fixture.width * 4); count++;
      } finally { this.release(payload); }
    }
    const error = mangaProbeDifference(output, expected);
    // JPEG fixtures use quality100/subsampling0. Permit only small decoder
    // rounding, far below the separated six-color orientation signatures.
    const pass = error.maximum <= (fixture.lossy ? 3 : 0) && error.mean <= (fixture.lossy ? 1 : 0);
    this.report({ caseId: fixture.id, phase: 'orientation-regions', pass, width: fixture.width, height: fixture.height,
      orientation: this.orientationProof, regions: count, sha256: await digest(output), expectedSha256: fixture.expectedSha256, maximum: error.maximum, mean: error.mean, presentationEvidence: false });
    this.check(this.balanced(), 'MANGA_PROBE_RESOURCE_BALANCE');
  }
  private async strips(): Promise<void> {
    const f = MANGA_PLATFORM_GRAPHICS;
    const encoded = await this.bytes(f.file, f.sha256);
    const expected = await this.bytes(f.expectedFile, f.expectedSha256);
    const planBytes = await this.bytes(f.planFile, f.planSha256);
    const plan = JSON.parse(new util.TextDecoder().decodeWithStream(planBytes)) as JsonObject;
    this.preEncoded = undefined;
    const jpeg = await this.graphics.transform(encoded, plan, this.current);
    const pixels = this.preEncoded;
    this.check(pixels !== undefined, 'MANGA_PROBE_PREENCODE_MISSING');
    const error = mangaProbeDifference(pixels!, expected);
    this.report({ caseId: 'graphics-14-strips', phase: 'pre-encode', pass: error.maximum === 0,
      sha256: await digest(pixels!), expectedSha256: f.expectedSha256, maximum: error.maximum, mean: error.mean, presentationEvidence: false });
    const output = await readPixels(image.createImageSource(jpeg.buffer as ArrayBuffer));
    const lossy = mangaProbeDifference(output.rgba, expected);
    // RGB565 plus JPEG90 is deliberately lossy. Geometry is asserted exactly
    // above, before either conversion. This only checks bounded output fidelity.
    const pass = output.width === 8 && output.height === 103 && lossy.mean <= 20 && lossy.maximum <= 100;
    this.report({ caseId: 'graphics-14-strips', phase: 'jpeg90-rgb565', pass,
      width: output.width, height: output.height, maximum: lossy.maximum, mean: lossy.mean, sha256: await digest(output.rgba), presentationEvidence: false });
    this.check(this.balanced() && this.graphics.diagnosticPending() === 0, 'MANGA_PROBE_GRAPHICS_RELEASE');
  }
  private async cancellation(graphics: boolean): Promise<void> {
    const f = MANGA_PLATFORM_FIXTURES[5];
    let rejected = false;
    this.nativeCancelled = false; this.cancelAtPixel = true;
    try {
      if (graphics) {
        const g = MANGA_PLATFORM_GRAPHICS;
        const encoded = await this.bytes(g.file, g.sha256);
        const plan = JSON.parse(new util.TextDecoder().decodeWithStream(await this.bytes(g.planFile, g.planSha256))) as JsonObject;
        await this.graphics.transform(encoded, plan, this.current);
      } else {
        const bytes = await this.bytes(f.file, f.sha256);
        const output = await this.body.loadBytes(bytes, this.current, 0);
        this.release(output);
      }
    } catch (error) { rejected = this.nativeCancelled && /cancel/i.test((error as Error).message); }
    finally { this.cancelAtPixel = false; this.nativeCancelled = false; }
    const settled = await this.settleDisplay();
    this.report({ caseId: graphics ? 'graphics-cancel' : 'body-cancel', phase: 'cancel-after-native-allocation',
      pass: rejected && this.balanced() && settled && this.graphics.diagnosticPending() === 0,
      sourceBalance: this.sources, pixelBalance: this.pixels, packerBalance: this.packers, releaseErrors: this.releaseErrors, presentationEvidence: false });
  }
  private async item(id: string, execute: () => Promise<void>): Promise<void> {
    if (this.cancelled) return;
    try { await execute(); }
    catch (error) { this.report({ caseId: id, phase: 'execution', pass: false, message: (error as Error).message.slice(0, 240), presentationEvidence: false }); }
  }
  run(): Promise<void> {
    if (this.task !== undefined) return this.task;
    this.task = this.execute();
    return this.task;
  }
  private async execute(): Promise<void> {
    if (DEBUG !== true || BUILD_MODE_NAME !== 'debug') throw new Error('MANGA_DIAGNOSTIC_UNAVAILABLE');
    await ReaderRuntimeOwner.current().start();
    this.check(this.current(), 'MANGA_PROBE_CANCELLED');
    this.baseline = this.body.diagnosticState();
    const bodyDetach = this.body.attachDiagnosticObserver(this.observe);
    let graphicsDetach: (() => void) | undefined;
    try {
      graphicsDetach = this.graphics.attachDiagnosticObserver(this.observe);
      for (const fixture of MANGA_PLATFORM_FIXTURES) await this.item(fixture.id, (): Promise<void> => this.orientation(fixture));
      for (const fixture of [MANGA_PLATFORM_FIXTURES[5], MANGA_PLATFORM_FIXTURES[29]]) await this.item(`contain-${fixture.id}`, (): Promise<void> => this.orientation(fixture, true));
      await this.item('strips', (): Promise<void> => this.strips());
      await this.item('body-cancel', (): Promise<void> => this.cancellation(false));
      await this.item('graphics-cancel', (): Promise<void> => this.cancellation(true));
      const settled = await this.settleDisplay();
      this.report({ caseId: 'all', phase: 'resources-before-display', pass: this.balanced() && settled && this.graphics.diagnosticPending() === 0,
        sourceBalance: this.sources, pixelBalance: this.pixels, packerBalance: this.packers, releaseErrors: this.releaseErrors,
        regions: this.regions, retainedDisplayLeases: 0, presentationEvidence: false });
      if (!this.cancelled) await this.item('arkui-display', async (): Promise<void> => {
        const fixture = MANGA_PLATFORM_FIXTURES[5];
        this.frame = await this.body.loadBytes(await this.bytes(fixture.file, fixture.sha256), this.current, 0);
        const loaded = await this.display({ id: `manga-probe-${++this.sequence}`, fileUri: this.frame.fileUri, width: this.frame.width, height: this.frame.height });
        this.report({ caseId: fixture.id, phase: 'arkui-image-callback', pass: loaded && !this.cancelled,
          displayCallback: loaded, retainedDisplayLeases: 1, message: 'Image.onComplete is loader evidence; compositor pixels still require target screenshot.', presentationEvidence: false });
      });
    } finally { graphicsDetach?.(); bodyDetach(); }
  }
  cancel(): void { this.cancelled = true; }
  async dispose(): Promise<void> {
    this.cancel();
    try { await this.task; } catch (_) { /* Still release the owned preview. */ }
    if (this.frame !== undefined) { this.release(this.frame); this.frame = undefined; }
    if (this.baseline !== undefined) this.report({ caseId: 'all', phase: 'dispose', pass: await this.settleDisplay() && this.balanced(),
      sourceBalance: this.sources, pixelBalance: this.pixels, packerBalance: this.packers, releaseErrors: this.releaseErrors,
      retainedDisplayLeases: 0, presentationEvidence: false });
  }
}
